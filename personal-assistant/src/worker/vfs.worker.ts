import * as Comlink from 'comlink';
import { SQLiteVFS } from './SQLiteVFS';

const vfs = new SQLiteVFS();
Comlink.expose(vfs);
