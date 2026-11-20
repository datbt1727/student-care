import {checkServerIdentity} from 'node:tls';
export function verifiedTls(client,hostname){
 const stream=client?.connection?.stream;
 if(stream?.encrypted!==true||stream.authorized!==true||stream.authorizationError||typeof stream.getPeerCertificate!=='function')throw Object.assign(Error('TLS not verified'),{safeCode:'TLS_NOT_CONFIRMED'});
 const certificate=stream.getPeerCertificate(true);
 if(!certificate||!Object.keys(certificate).length||checkServerIdentity(hostname,certificate))throw Object.assign(Error('TLS hostname not verified'),{safeCode:'TLS_NOT_CONFIRMED'});
 return true;
}
