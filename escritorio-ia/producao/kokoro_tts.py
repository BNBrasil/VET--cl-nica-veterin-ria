"""Narração com Kokoro (grátis, offline, Apache 2.0) — chamado pelo producao/tts.js.

Uso: python kokoro_tts.py <modelo.onnx> <vozes.bin> <voz> <velocidade> <saida.wav>
O texto (já normalizado pelo tts.js) chega pelo stdin, em UTF-8.
Vozes em português do Brasil: pm_alex, pm_santa (masculinas), pf_dora (feminina).
"""
import sys


def main():
    if len(sys.argv) != 6:
        print(__doc__, file=sys.stderr)
        return 2
    modelo, vozes, voz, velocidade, saida = sys.argv[1:]
    texto = sys.stdin.buffer.read().decode('utf-8').strip()
    if not texto:
        print('texto vazio', file=sys.stderr)
        return 2
    import soundfile as sf
    from kokoro_onnx import Kokoro

    k = Kokoro(modelo, vozes)
    if voz not in k.get_voices():
        print(f'voz desconhecida: {voz}', file=sys.stderr)
        return 3
    audio, sr = k.create(texto, voice=voz, speed=float(velocidade), lang='pt-br')
    sf.write(saida, audio, sr)
    return 0


if __name__ == '__main__':
    sys.exit(main())
