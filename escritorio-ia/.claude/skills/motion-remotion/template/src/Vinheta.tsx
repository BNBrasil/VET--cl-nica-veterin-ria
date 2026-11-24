import { AbsoluteFill, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

export type VinhetaProps = {
  titulo: string;
  subtitulo: string;
  corFundo: string;
  corDestaque: string;
};

const Titulo: React.FC<{ texto: string; cor: string; vertical: boolean }> = ({ texto, cor, vertical }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entrada = spring({ frame, fps, config: { damping: 200 } });
  const y = interpolate(entrada, [0, 1], [80, 0]);
  return (
    <div
      style={{
        fontFamily: 'Inter, system-ui, sans-serif',
        fontWeight: 800,
        fontSize: vertical ? 120 : 140,
        color: 'white',
        textAlign: 'center',
        transform: `translateY(${y}px)`,
        opacity: entrada,
        textShadow: `0 8px 0 ${cor}`,
        padding: '0 80px',
      }}
    >
      {texto}
    </div>
  );
};

const Subtitulo: React.FC<{ texto: string; vertical: boolean }> = ({ texto, vertical }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: 'clamp' });
  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: vertical ? 56 : 48, color: '#ddd', opacity, marginTop: 32, textAlign: 'center' }}>
      {texto}
    </div>
  );
};

export const Vinheta: React.FC<VinhetaProps> = ({ titulo, subtitulo, corFundo, corDestaque }) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const vertical = height > width;
  // barra de destaque que cresce e some no fim
  const barra = interpolate(frame, [0, 20, durationInFrames - 10, durationInFrames], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const saida = interpolate(frame, [durationInFrames - 8, durationInFrames], [1, 0], { extrapolateLeft: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: corFundo, justifyContent: 'center', alignItems: 'center', opacity: saida }}>
      <AbsoluteFill style={{ justifyContent: 'flex-end' }}>
        <div style={{ height: 24, width: `${barra * 100}%`, backgroundColor: corDestaque }} />
      </AbsoluteFill>
      <Sequence from={5} layout="none">
        <Titulo texto={titulo} cor={corDestaque} vertical={vertical} />
      </Sequence>
      <Sequence from={20} layout="none">
        <Subtitulo texto={subtitulo} vertical={vertical} />
      </Sequence>
    </AbsoluteFill>
  );
};
