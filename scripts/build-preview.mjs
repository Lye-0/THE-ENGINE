// Build a portable preview; the production project stays split into source files.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let html=await readFile(path.join(root,'index.html'),'utf8');
const css=await readFile(path.join(root,'css/style.css'),'utf8');
html=html.replace(/<link rel="stylesheet"[^>]*>/,()=>'<style>\n'+css+'\n</style>');
const scripts=[...html.matchAll(/<script defer src="\.\/([^\"]+)"><\/script>/g)].map(m=>m[1]);
html=html.replace(/\s*<script defer src="[^\"]+"><\/script>/g,'');
const source=(await Promise.all(scripts.map(f=>readFile(path.join(root,f),'utf8')))).join('\n;\n');
html=html.replace('</body>',()=>'<script>\n'+source.replace(/<\/script/gi,'<\\/script')+'\n</script>\n</body>');
const icon=await readFile(path.join(root,'favicon.svg'));
html=html.replace('./favicon.svg','data:image/svg+xml;base64,'+icon.toString('base64'));
const output=process.argv[2]?path.resolve(process.argv[2]):path.join(root,'preview','FERRO-preview.html');
await mkdir(path.dirname(output),{recursive:true});await writeFile(output,html);console.log(output);
