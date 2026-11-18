"""Export the Hol-CCG RoBERTa encoder and CKY scoring heads."""
import argparse
import json
from pathlib import Path

import torch
from holccg import InferenceOptions, Parser


class Encoder(torch.nn.Module):
    def __init__(self, model):
        super().__init__()
        self.encoder = model.encoder
        self.projection = model.projection
        self.classifier = model.word_category_classifier
        self.norm = model.vector_norm

    def forward(self, ids, pooling):
        states = self.encoder(input_ids=ids, attention_mask=torch.ones_like(ids)).last_hidden_state[0]
        vectors = torch.nn.functional.normalize(self.projection(pooling @ states), dim=-1) * self.norm
        return vectors, self.classifier(vectors).softmax(-1)


class CompositionHeads(torch.nn.Module):
    def __init__(self, model):
        super().__init__()
        self.span = model.span_existence_classifier
        self.phrase = model.phrase_category_classifier

    def forward(self, vectors):
        return self.span(vectors).softmax(-1)[:, 1], self.phrase(vectors).softmax(-1)


def export(model_path, output):
    torch.set_num_threads(3)
    output.mkdir(parents=True, exist_ok=True)
    parser = Parser.from_pretrained(model_path, device='cpu', options=InferenceOptions(grammar='treebank'))
    model = parser.model
    model.encoder.set_attn_implementation('eager')
    if model.config.normalization_type != 'real' or model.config.model_dim != 1024:
        raise ValueError('Unsupported Hol-CCG checkpoint configuration')

    def onnx(module, inputs, filename, input_names, output_names, axes):
        torch.onnx.export(module.eval(), inputs, str(output / filename), input_names=input_names,
                          output_names=output_names, dynamic_axes=axes, opset_version=20, dynamo=False,
                          do_constant_folding=True)

    onnx(Encoder(model), (torch.tensor([[0, 100, 200, 2]]), torch.tensor([[0., 1., 0., 0.], [0., 0., 1., 0.]])),
         'encoder.onnx', ['ids', 'pooling'], ['vectors', 'probabilities'],
         {'ids': {1: 'subwords'}, 'pooling': {0: 'words', 1: 'subwords'},
          'vectors': {0: 'words'}, 'probabilities': {0: 'words'}})
    onnx(CompositionHeads(model), (torch.zeros((2, 1024)),), 'heads.onnx',
         ['vectors'], ['spans', 'phrases'], {name: {0: 'pairs'} for name in ['vectors', 'spans', 'phrases']})

    grammar = {}
    for (left, right), parents in model.binary_rule.items():
        rules = []
        for parent in parents:
            index = model.phrase_category2index.get(parent, 0)
            if index:
                head = model.head_info.get((left, right, parent.split('-->')[0]), 0)
                rules.append([parent, index, head])
        if rules:
            grammar.setdefault(left, {})[right] = rules

    labels = {str(index): label for label, index in model.word_category2index.items() if index and label}
    (output / 'grammar.json').write_text(json.dumps(
        {'grammar': grammar, 'words': labels, 'norm': model.vector_norm}, ensure_ascii=False, separators=(',', ':')),
        encoding='utf-8')


if __name__ == '__main__':
    arguments = argparse.ArgumentParser()
    arguments.add_argument('checkpoint', type=Path)
    arguments.add_argument('output', type=Path)
    options = arguments.parse_args()
    export(options.checkpoint, options.output)
