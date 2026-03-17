import { NanoMuxAPI } from '../preload/preload';

declare global {
  interface Window {
    nanoMux: NanoMuxAPI;
  }
}
