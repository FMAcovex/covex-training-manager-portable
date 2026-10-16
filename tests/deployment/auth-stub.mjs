// CI only: never copied into the runtime image. Does not represent Entra validation.
import { createServer } from 'node:http';
createServer((req,res)=>{
  if (req.url === '/oauth2/auth') {
    if(req.headers.cookie === 'ci=invalid') {res.writeHead(202, {'Authorization':'Bearer invalid.invalid.invalid'});res.end();}
    else {res.writeHead(401);res.end();}
  } else {res.writeHead(200);res.end('CI authentication stub');}
}).listen(4180,'0.0.0.0');
