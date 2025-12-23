import * as Comlink from 'comlink';
import { IVirtualFileSystem } from '../shared/types';
import VFSWorker from '../worker/vfs.worker?worker';

const worker = new VFSWorker();
export const workerVFS = Comlink.wrap<IVirtualFileSystem>(worker);
