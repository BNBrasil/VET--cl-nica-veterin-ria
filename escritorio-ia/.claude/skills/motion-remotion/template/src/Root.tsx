import { Composition } from 'remotion';
import { Vinheta, type VinhetaProps } from './Vinheta';

const FPS = 30;
const DURACAO_S = 3;

const props: VinhetaProps = {
  titulo: 'Escritório de IA',
  subtitulo: 'Roteiro · Animação · Edição',
  corFundo: '#1b1b2a',
  corDestaque: '#9a4ad8',
};

export const Root: React.FC = () => (
  <>
    <Composition
      id="Vinheta9x16"
      component={Vinheta}
      durationInFrames={DURACAO_S * FPS}
      fps={FPS}
      width={1080}
      height={1920}
      defaultProps={props}
    />
    <Composition
      id="Vinheta16x9"
      component={Vinheta}
      durationInFrames={DURACAO_S * FPS}
      fps={FPS}
      width={1920}
      height={1080}
      defaultProps={props}
    />
  </>
);
