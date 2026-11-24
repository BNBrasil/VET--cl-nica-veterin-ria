import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setCodec('h264');
Config.setCrf(18);
Config.setPixelFormat('yuv420p');
Config.setOverwriteOutput(false); // nunca sobrescreve render já entregue: versione (_v02)
Config.setEntryPoint('src/index.ts');
