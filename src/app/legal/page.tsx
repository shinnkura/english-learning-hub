/**
 * 利用規約とプライバシーポリシーを表示するページコンポーネント
 * @module LegalPage
 */

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
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

  useEffect(() => {
    // 利用規約とプライバシーポリシーのMarkdownファイルを読み込む
    const loadContent = async () => {
      try {
        const [termsModule, privacyModule] = await Promise.all([
          import("./content/terms.md?raw"),
          import("./content/privacy.md?raw"),
        ]);
        setTermsContent(termsModule.default);
        setPrivacyContent(privacyModule.default);
      } catch (error) {
        console.error("Failed to load legal content:", error);
      }
    };

    loadContent();
  }, []);

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
