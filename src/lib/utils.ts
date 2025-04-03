/**
 * ユーティリティ関数
 * @module Utils
 */

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * クラス名を結合する関数
 * @param {ClassValue[]} inputs - 結合するクラス名の配列
 * @returns {string} 結合されたクラス名
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
