import { YoutubeTranscript } from 'youtube-transcript';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const videoId = url.pathname.split('/').pop();

    if (!videoId) {
      return new Response(JSON.stringify({ error: '動画IDが指定されていません' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const transcripts = await YoutubeTranscript.fetchTranscript(videoId, {
      lang: 'en'
    });
    
    if (!transcripts || transcripts.length === 0) {
      return new Response(JSON.stringify({ error: 'この動画には英語の字幕がありません。' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const captions = transcripts.map(transcript => ({
      start: transcript.offset / 1000,
      end: (transcript.offset + transcript.duration) / 1000,
      text: transcript.text
    }));

    return new Response(JSON.stringify(captions), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error fetching captions:', error);
    
    if (error.message?.includes('Transcript is disabled')) {
      return new Response(JSON.stringify({ error: 'この動画では字幕が無効になっています。' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    return new Response(JSON.stringify({ 
      error: '字幕の取得に失敗しました。この動画は英語の字幕が利用できない可能性があります。'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}