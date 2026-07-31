// ============================================
// Password Hashing
// ============================================
// Usa bcryptjs (custo 12) para armazenar senhas com segurança.
// Implementação pura em JS (sem binários nativos), evitando
// dependências de build vulneráveis e simplificando a imagem Docker.
// Nunca armazenar ou logar senhas em texto puro.

import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

/**
 * Gera o hash de uma senha em texto puro.
 * @param {string} plainPassword
 * @returns {Promise<string>} Hash bcrypt
 */
export function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

/**
 * Compara uma senha em texto puro com um hash armazenado.
 * @param {string} plainPassword
 * @param {string} passwordHash
 * @returns {Promise<boolean>}
 */
export function comparePassword(plainPassword, passwordHash) {
  return bcrypt.compare(plainPassword, passwordHash);
}
