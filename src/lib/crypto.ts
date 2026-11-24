import crypto from "crypto";

// Chiffrement au repos AES-256-GCM (spec section 6.2)
//
// Principes :
// - la cle maitre provient de APP_ENCRYPTION_KEY (64 caracteres hexadecimaux,
//   soit 32 octets = 256 bits) et n'est JAMAIS stockee en base ;
// - un IV unique (12 octets) est genere a chaque chiffrement : deux
//   chiffrements de la meme valeur produisent deux textes chiffres
//   differents, ce qui rend les comparaisons impossibles (critere CA4) ;
// - GCM produit un tag d'authentification (16 octets) qui detecte toute
//   alteration de la donnee chiffree.
//
// Les trois composants (valueEnc, iv, authTag) sont stockes en base64
// dans les modeles Secret et PersonalSecret.

const IV_LENGTH = 12; // 96 bits - recommandation NIST pour GCM

export interface EncryptedValue {
  valueEnc: string; // valeur chiffree, base64
  iv: string; // vecteur d'initialisation, base64
  authTag: string; // tag d'authentification GCM, base64
}

function getMasterKey(): Buffer {
  const raw = process.env.APP_ENCRYPTION_KEY ?? "";
  if (!/^[0-9a-fA-F]{64}$/.test(raw)) {
    throw new Error(
      "APP_ENCRYPTION_KEY invalide ou manquante : attendu 64 caractères hexadécimaux (générer avec : openssl rand -hex 32)"
    );
  }
  return Buffer.from(raw, "hex");
}

export function encrypt(plaintext: string): EncryptedValue {
  const key = getMasterKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  return {
    valueEnc: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

export function decrypt({ valueEnc, iv, authTag }: EncryptedValue): string {
  const key = getMasterKey();
  try {
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(iv, "base64")
    );
    decipher.setAuthTag(Buffer.from(authTag, "base64"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(valueEnc, "base64")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    // Ne jamais exposer la cause exacte (cle changee ? donnee alteree ?),
    // conformement a la section 6.6 de la spec.
    throw new Error("Déchiffrement impossible");
  }
}
