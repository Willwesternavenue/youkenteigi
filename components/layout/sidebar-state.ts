/**
 * サイドバー開閉状態を保存する cookie 名。server layout（初回描画の幅）と
 * client の AppSidebar（開閉時の保存）の両方から読むため、"use client" の外に置く。
 */
export const SIDEBAR_COLLAPSED_COOKIE = "sidebar_collapsed";
