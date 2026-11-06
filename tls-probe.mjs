import net from 'node:net';
import tls from 'node:tls';
import assert from 'node:assert/strict';
import { databaseTls } from './lib.mjs';

// PostgreSQL SSLRequest only: no startup/login message, password or SQL.
const host = 'aws-1-eu-central-1.pooler.supabase.com';
function handshake(ssl) {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host, port: 5432 });
    let secure;
    const timer = setTimeout(() => fail(Object.assign(new Error('timeout'), {code:'ETIMEDOUT'})), 12000);
    function cleanup() { clearTimeout(timer); secure?.destroy(); socket.destroy(); }
    function fail(error) { cleanup(); reject(error); }
    socket.on('error', fail);
    socket.once('connect', () => {
      const request = Buffer.alloc(8);
      request.writeInt32BE(8, 0);
      request.writeInt32BE(80877103, 4);
      socket.write(request);
    });
    socket.once('data', data => {
      if (data.length !== 1 || data[0] !== 83) return fail(new Error('SSL request rejected'));
      secure = tls.connect({ ...ssl, socket, servername: host });
      secure.once('error', fail);
      secure.once('secureConnect', () => { const authorized = secure.authorized; cleanup(); resolve(authorized); });
    });
  });
}
try {
  const rejected = await handshake({ ca: tls.rootCertificates[0], rejectUnauthorized: true }).then(() => false, error => {
    if (!['SELF_SIGNED_CERT_IN_CHAIN','UNABLE_TO_VERIFY_LEAF_SIGNATURE','UNABLE_TO_GET_ISSUER_CERT_LOCALLY'].includes(error.code)) throw error;
    return true;
  });
  assert.equal(rejected, true, 'Unrelated CA must be rejected');
  assert.equal(await handshake(databaseTls()), true, 'Supabase CA and hostname must verify');
  console.log('TLS regression passed: unrelated CA rejected, official CA and hostname verified. No authentication or SQL sent.');
} catch {
  console.error('TLS regression failed; raw connection error omitted.');
  process.exitCode = 1;
}
