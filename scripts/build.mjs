import {mkdir,cp,rm} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
const target=resolve('dist');if(!target.startsWith(process.cwd()+sep))throw Error('Unsafe build path');
await rm(target,{recursive:true,force:true});await mkdir(target,{recursive:true});await cp('public',target,{recursive:true});console.log('Built static site in dist');
