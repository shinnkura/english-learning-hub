import React, { useState, useEffect } from "react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/tabs";
import { Card, CardContent } from "../../components/ui/card";
import { ScrollArea } from "../../components/ui/scroll-area";
import { Button } from "../../components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * 利用規約とプライバシーポリシーを表示するページコンポーネント
 * @returns {JSX.Element} 利用規約とプライバシーポリシーのページ
 */
export default function LegalPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("terms");
  const [termsContent, setTermsContent] = useState("");
  const [privacyContent, setPrivacyContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 利用規約とプライバシーポリシーのMarkdownファイルを読み込む
    const loadContent = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const termsResponse = await fetch("/legal/content/terms.md");
        const privacyResponse = await fetch("/legal/content/privacy.md");

        if (!termsResponse.ok || !privacyResponse.ok) {
          throw new Error("コンテンツの読み込みに失敗しました");
        }

        const [terms, privacy] = await Promise.all([
          termsResponse.text(),
          privacyResponse.text(),
        ]);

        setTermsContent(terms);
        setPrivacyContent(privacy);
      } catch (error) {
        console.error("Failed to load legal content:", error);
        setError("コンテンツの読み込み中にエラーが発生しました。");
      } finally {
        setIsLoading(false);
      }
    };

    loadContent();
  }, []);

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Button variant="ghost" className="mb-4" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          戻る
        </Button>
        <div className="text-center">
          <p className="text-red-500">{error}</p>
          <Button onClick={() => window.location.reload()} className="mt-4">
            再読み込み
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <Button variant="ghost" className="mb-4" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          戻る
        </Button>
        <h1 className="text-3xl font-bold mb-4">法的情報</h1>
        <p className="text-muted-foreground">
          利用規約とプライバシーポリシーをご確認ください。
        </p>
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
                {isLoading ? (
                  <div className="flex justify-center items-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                  </div>
                ) : (
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {termsContent}
                    </ReactMarkdown>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="privacy">
          <Card>
            <CardContent className="p-6">
              <ScrollArea className="h-[calc(100vh-300px)]">
                {isLoading ? (
                  <div className="flex justify-center items-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                  </div>
                ) : (
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {privacyContent}
                    </ReactMarkdown>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
