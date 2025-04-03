/**
 * 利用規約とプライバシーポリシーを表示するページコンポーネント
 * @module LegalPage
 */

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// 利用規約のコンテンツ
const termsContent = `
# 利用規約

## 1. はじめに

本利用規約（以下「本規約」）は、English Learning Hub（以下「本サービス」）の利用条件を定めるものです。

## 2. YouTube APIの利用について

本サービスはYouTube APIを利用しています。本サービスを利用することで、[YouTube利用規約](https://www.youtube.com/t/terms)に同意したことになります。

## 3. 禁止事項

本サービスの利用者は、以下の行為をしてはなりません：

- 法令または公序良俗に違反する行為
- 犯罪行為に関連する行為
- 本サービスの運営を妨害するおそれのある行為
- 本サービスの運営者の信頼を毀損する行為
`;

// プライバシーポリシーのコンテンツ
const privacyContent = `
# プライバシーポリシー

## 1. はじめに

English Learning Hub（以下「本サービス」）は、ユーザーのプライバシーを尊重し、個人情報の保護に努めています。

## 2. YouTube APIの利用について

当サービスはYouTube APIサービスを使用しています。YouTube APIの利用に関連するプライバシーについては、[Googleのプライバシーポリシー](http://www.google.com/policies/privacy)をご確認ください。

## 3. 収集する情報

本サービスでは、以下の情報を収集する場合があります：

### 3.1 ユーザーが提供する情報
- アカウント情報（メールアドレス、ユーザー名）
- YouTubeアカウントとの連携情報
- 学習履歴や進捗状況

### 3.2 自動的に収集される情報
- デバイス情報（IPアドレス、ブラウザの種類、OSの種類）
- Cookie情報
- アクセスログ
- YouTubeの視聴履歴（連携時）
`;

/**
 * 利用規約とプライバシーポリシーを表示するページコンポーネント
 * @returns {JSX.Element} 利用規約とプライバシーポリシーのページ
 */
export default function LegalPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("terms");

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <Button variant="ghost" className="mb-4" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          戻る
        </Button>
        <h1 className="text-3xl font-bold mb-4">法的情報</h1>
        <p className="text-muted-foreground">利用規約とプライバシーポリシーをご確認ください。</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="terms">利用規約</TabsTrigger>
          <TabsTrigger value="privacy">プライバシーポリシー</TabsTrigger>
        </TabsList>

        <TabsContent value="terms">
          <Card>
            <CardContent className="p-6">
              <ScrollArea className="h-[calc(100vh-300px)]">
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{termsContent}</ReactMarkdown>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="privacy">
          <Card>
            <CardContent className="p-6">
              <ScrollArea className="h-[calc(100vh-300px)]">
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{privacyContent}</ReactMarkdown>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
