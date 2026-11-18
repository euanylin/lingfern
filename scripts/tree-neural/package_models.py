"""Quantize and split verified local ONNX exports for the optional browser downloads."""
import argparse
import json
from pathlib import Path
import shutil
from tempfile import TemporaryDirectory

import numpy as np
import onnx
from onnx import helper, numpy_helper

CHUNK = 16 * 1024 * 1024
MAX_GRAPH = 160 * 1024 * 1024
WASM = 'ort-wasm-simd-threaded.wasm'


def quantize(file, hol_encoder):
    model = onnx.load(file)
    axes = {}
    if hol_encoder:
        for node in model.graph.node:
            if node.op_type == 'Gather':
                axes[node.input[0]] = 0
            elif node.op_type == 'MatMul':
                axes[node.input[1]] = 1

    decoders = []
    for parameter in list(model.graph.initializer):
        if len(parameter.dims) < 2:
            continue
        weights = numpy_helper.to_array(parameter)
        name = parameter.name
        if hol_encoder:
            axis = axes.get(name)
            if axis is None or weights.ndim != 2 or weights.size < 500000:
                continue
        else:
            if weights.size < 250000:
                continue
            axis = 0 if weights.ndim == 2 and any(x in name for x in ('embedding', 'char_emb', 'Gemm')) else 1
        if weights.dtype != np.float32:
            continue

        reduced = tuple(i for i in range(weights.ndim) if i != axis)
        scale = np.maximum(np.max(np.abs(weights), axis=reduced) / 127, 1e-12)
        shape = [1] * weights.ndim
        shape[axis] = -1
        quant = np.rint(weights / scale.reshape(shape)).clip(-127, 127).astype(np.int8)
        model.graph.initializer.remove(parameter)
        model.graph.initializer.extend([
            numpy_helper.from_array(quant, name + '.int8'),
            numpy_helper.from_array(scale, name + '.scale'),
        ])
        decoders.append(helper.make_node('DequantizeLinear', [name + '.int8', name + '.scale'], [name], axis=axis))
    decoders.extend(model.graph.node)
    model.graph.ClearField('node')
    model.graph.node.extend(decoders)
    onnx.checker.check_model(model)
    return model.SerializeToString()


def package(name, export, wasm, checkpoint, target):
    if name == 'stanza':
        graphs = ['words', 'constituent', 'transition', 'predict', 'reduce']
        shutil.copyfile(export / 'metadata.json', target / 'metadata.json')
    else:
        graphs = ['encoder', 'heads']
        shutil.copyfile(export / 'grammar.json', target / 'grammar.json')
        for file in ('tokenizer.json', 'tokenizer_config.json'):
            shutil.copyfile(checkpoint / file, target / file)
    sizes = {}
    for graph in graphs:
        file = export / (graph + '.onnx')
        data = file.read_bytes() if graph == 'heads' else quantize(file, name == 'hol-ccg')
        if not 0 < len(data) <= MAX_GRAPH:
            raise ValueError(f'{graph} is outside the browser graph size limit')
        sizes[graph] = len(data)
        for index, start in enumerate(range(0, len(data), CHUNK)):
            (target / f'{graph}-{index}.bin').write_bytes(data[start:start + CHUNK])
    (target / 'graphs.json').write_text(json.dumps(sizes, indent=2) + '\n', encoding='utf-8')
    shutil.copyfile(wasm, target / WASM)


if __name__ == '__main__':
    cli = argparse.ArgumentParser()
    cli.add_argument('engine', choices=['stanza', 'hol-ccg'])
    cli.add_argument('export', type=Path)
    cli.add_argument('wasm', type=Path)
    cli.add_argument('target', type=Path)
    cli.add_argument('--checkpoint', type=Path)
    args = cli.parse_args()
    if args.engine == 'hol-ccg' and not args.checkpoint:
        cli.error('--checkpoint is required for Hol-CCG tokenizer files')
    if args.target.exists() or args.target.is_symlink():
        cli.error('The target directory must be new')
    args.target.parent.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory(prefix='.tree-model-', dir=args.target.parent) as temporary:
        staged = Path(temporary)
        package(args.engine, args.export, args.wasm, args.checkpoint, staged)
        staged.rename(args.target)
