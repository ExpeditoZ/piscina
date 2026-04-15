/**
 * GET /api/telegram-webhook/setup
 * 
 * One-time setup endpoint to register the Telegram webhook URL.
 * Call this after deploying to production:
 *   https://your-domain.com/api/telegram-webhook/setup
 * 
 * Protected by CRON_SECRET to prevent unauthorized access.
 * Pass ?secret=YOUR_CRON_SECRET as a query param.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && secret !== cronSecret) {
    return Response.json({ error: "Unauthorized. Pass ?secret=YOUR_CRON_SECRET" }, { status: 401 });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!botToken) {
    return Response.json({ error: "TELEGRAM_BOT_TOKEN not set" }, { status: 500 });
  }

  // Derive the webhook URL from the current request's host
  const host = request.headers.get("host");
  const protocol = host?.includes("localhost") ? "http" : "https";
  const webhookUrl = `${protocol}://${host}/api/telegram-webhook`;

  // Register with Telegram
  const params = new URLSearchParams({ url: webhookUrl });
  if (webhookSecret) {
    params.set("secret_token", webhookSecret);
  }

  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/setWebhook?${params.toString()}`,
    { method: "POST" }
  );
  const result = await response.json();

  // Also get current webhook info for verification
  const infoResponse = await fetch(
    `https://api.telegram.org/bot${botToken}/getWebhookInfo`
  );
  const info = await infoResponse.json();

  return Response.json({
    action: "setWebhook",
    webhookUrl,
    telegramResponse: result,
    currentWebhookInfo: info.result,
  });
}
