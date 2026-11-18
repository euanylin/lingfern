"""Export the Stanza in-order constituency parser as browser inference graphs."""
import argparse
import json
from pathlib import Path

import torch
from torch import nn
from stanza.models.constituency.trainer import Trainer
from stanza.models.constituency.parse_transitions import CloseConstituent, OpenConstituent, Shift


def dense_lstm(packed):
    lstm = packed.lstm
    if isinstance(lstm, nn.LSTM):
        return lstm
    dense = nn.LSTM(lstm.cells[0].input_size, lstm.hidden_size, lstm.num_layers, batch_first=lstm.batch_first)
    with torch.no_grad():
        for layer, cell in enumerate(lstm.cells):
            for name, weight in cell.named_parameters():
                getattr(dense, f'{name}_l{layer}').copy_(weight)
    return dense


class WordQueue(nn.Module):
    def __init__(self, model):
        super().__init__()
        self.model = model
        self.forward_lstm = dense_lstm(model.forward_charlm.charlstm)
        self.backward_lstm = dense_lstm(model.backward_charlm.charlstm)

    def forward(self, word, delta, tag, forward_chars, forward_offsets, backward_chars, backward_offsets):
        m = self.model
        f = m.forward_charlm
        b = m.backward_charlm
        f_output, _ = self.forward_lstm(f.char_emb(forward_chars.unsqueeze(0)), (f.charlstm_h_init, f.charlstm_c_init))
        b_output, _ = self.backward_lstm(b.char_emb(backward_chars.unsqueeze(0)), (b.charlstm_h_init, b.charlstm_c_init))
        values = torch.cat((m.embedding(word), m.delta_embedding(delta), m.tag_embedding(tag),
                            f_output[0, forward_offsets], b_output[0, backward_offsets]), dim=1)
        sequence = torch.cat((m.word_start_embedding.unsqueeze(0), values, m.word_end_embedding.unsqueeze(0)))
        output, _ = m.word_lstm(sequence.unsqueeze(1))
        return m.nonlinearity(m.word_to_constituent(output[:, 0]))


class TransitionStep(nn.Module):
    def __init__(self, model):
        super().__init__()
        self.model = model

    def forward(self, transition, h, c):
        m = self.model
        _, (h, c) = m.transition_stack.lstm(m.transition_embedding(transition).reshape(1, 1, -1), (h, c))
        return h, c


class ConstituentStep(nn.Module):
    def __init__(self, model):
        super().__init__()
        self.model = model

    def forward(self, value, h, c):
        m = self.model
        _, (h, c) = m.constituent_stack.lstm(value.reshape(1, 1, -1), (h, c))
        return h, c


class Reduce(nn.Module):
    def __init__(self, model):
        super().__init__()
        self.linear = model.reduce_linear
        self.nonlinearity = model.nonlinearity

    def forward(self, values):
        return self.nonlinearity(self.linear(values.amax(dim=0)))


class Predict(nn.Module):
    def __init__(self, model):
        super().__init__()
        self.model = model

    def forward(self, word, transition, constituent):
        m = self.model
        value = torch.cat((word, transition, constituent))
        for layer in m.output_layers:
            value = layer(m.nonlinearity(value))
        return value


def export(model_path, output):
    torch.set_num_threads(2)
    output.mkdir(parents=True, exist_ok=True)
    args = {
        'wordvec_pretrain_file': str(model_path / 'pretrain/conll17.pt'),
        'charlm_forward_file': str(model_path / 'forward_charlm/1billion.pt'),
        'charlm_backward_file': str(model_path / 'backward_charlm/1billion.pt'),
        'device': 'cpu',
    }
    trainer = Trainer.load(str(model_path / 'constituency/ptb3-revised_charlm.pt'), args=args, load_optimizer=False)
    model = trainer.model.eval()
    assert model.transition_scheme.name == 'IN_ORDER'
    assert model.constituency_composition.name == 'MAX'
    assert not any((model.bert_model, model.partitioned_transformer_module, model.label_attention_module,
                    model.rel_attn_forward, model.rel_attn_reverse, model.reverse_sentence, model.maxout_k))
    assert all(isinstance(t, (Shift, CloseConstituent, OpenConstituent)) for t in model.transitions)
    assert all(len(t.label) == 1 for t in model.transitions if isinstance(t, OpenConstituent))

    def save(name, graph, inputs, names, outputs, dynamic=None):
        torch.onnx.export(graph.eval(), inputs, str(output / f'{name}.onnx'), input_names=names,
                          output_names=outputs, dynamic_axes=dynamic, opset_version=20, dynamo=False)

    indices = torch.tensor([2, 3])
    chars = torch.tensor([3, 4, 5, 6, 7])
    names = ['word', 'delta', 'tag', 'forward_chars', 'forward_offsets', 'backward_chars', 'backward_offsets']
    save('words', WordQueue(model), (indices, indices, indices, chars, indices, chars, indices), names, ['queue'],
         {name: {0: name if name.endswith('chars') else 'words'} for name in names})
    h = model.hidden_size
    ts = model.initial_transitions().value
    cs = model.initial_constituents().value
    state = lambda v: (v.lstm_hx.detach().unsqueeze(1), v.lstm_cx.detach().unsqueeze(1))
    save('transition', TransitionStep(model), (indices[:1], *state(ts)), ['index', 'h', 'c'], ['next_h', 'next_c'])
    save('constituent', ConstituentStep(model), (torch.ones(h), *state(cs)),
         ['value', 'h', 'c'], ['next_h', 'next_c'])
    save('reduce', Reduce(model), (torch.ones((2, h)),), ['values'], ['tree'],
         {'values': {0: 'children'}})
    save('predict', Predict(model), (torch.zeros(h), ts.output, cs.output),
         ['word', 'transition', 'constituent'], ['scores'])
    metadata = dict(
        word=model.emb_vocab._unit2id, delta=model.delta_word_map, tag=model.tag_map,
        forward=model.forward_charlm.char_vocab()._unit2id, backward=model.backward_charlm.char_vocab()._unit2id,
        transitions=[(t.short_name().lower(), t.label[0] if isinstance(t, OpenConstituent) else None,
                      model.constituent_open_map[t.label] if isinstance(t, OpenConstituent) else None)
                     for t in model.transitions],
        initial_transition=[v.flatten().tolist() for v in state(ts)],
        initial_constituent=[v.flatten().tolist() for v in state(cs)],
        opens=model.dummy_embedding.weight.detach().tolist(),
        width=h, unary_limit=model.unary_limit, root_labels=list(model.root_labels),
    )
    (output / 'metadata.json').write_text(json.dumps(metadata, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')


if __name__ == '__main__':
    cli = argparse.ArgumentParser()
    cli.add_argument('checkpoint', type=Path)
    cli.add_argument('output', type=Path)
    args = cli.parse_args()
    export(args.checkpoint, args.output)
