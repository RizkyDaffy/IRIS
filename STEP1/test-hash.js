const argon2 = require('argon2');
async function main() {
  const hash = '$argon2id$v=19$m=65536,t=3,p=4$J2SgVDKYGNLU97yaIJmaCg$EKKd85Fu+WEflVwEOugaHH7NAZHW99pRuEHzaF8HXbs';
  const token = '6b08cb4174ff0877fec36c432dec505ee1cd43ab654feedd0859bb62fd29';
  const valid = await argon2.verify(hash, token);
  console.log('IS VALID:', valid);
}
main();
