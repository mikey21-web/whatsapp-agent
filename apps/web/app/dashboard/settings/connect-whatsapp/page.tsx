'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface SignupConfig {
  appId: string;
  configId: string;
  graphVersion: string;
  enabled: boolean;
}

declare global {
  interface Window {
    FB?: {
      init: (cfg: { appId: string; cookie: boolean; xfbml: boolean; version: string }) => void;
      login: (
        cb: (response: { authResponse?: { code?: string }; status: string }) => void,
        opts: { config_id: string; response_type: 'code'; override_default_response_type: boolean; extras: Record<string, unknown> },
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}

export default function ConnectWhatsappPage() {
  const router = useRouter();
  const [signupResult, setSignupResult] = useState<{
    code?: string;
    wabaId?: string;
    phoneNumberId?: string;
    error?: string;
  } | null>(null);
  const [manualWaba, setManualWaba] = useState('');
  const [manualPhoneId, setManualPhoneId] = useState('');

  const { data: cfg } = useQuery({
    queryKey: ['embedded-signup-config'],
    queryFn: () => api<SignupConfig>('/whatsapp/embedded-signup/config'),
  });

  // Listen for the message event Meta posts back during embedded signup
  // containing waba_id + phone_number_id.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (typeof e.data !== 'string') return;
      try {
        const parsed = JSON.parse(e.data);
        if (parsed.type !== 'WA_EMBEDDED_SIGNUP') return;
        if (parsed.event === 'FINISH') {
          setSignupResult((prev) => ({
            ...(prev ?? {}),
            wabaId: parsed.data?.waba_id,
            phoneNumberId: parsed.data?.phone_number_id,
          }));
        }
        if (parsed.event === 'CANCEL') setSignupResult({ error: 'Cancelled' });
      } catch {
        /* not our message */
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  function launchSignup() {
    if (!cfg?.enabled || !window.FB) return;
    window.FB.login(
      (response) => {
        if (response.authResponse?.code) {
          setSignupResult((prev) => ({ ...(prev ?? {}), code: response.authResponse!.code }));
        } else {
          setSignupResult({ error: 'No auth code returned' });
        }
      },
      {
        config_id: cfg.configId,
        response_type: 'code',
        override_default_response_type: true,
        extras: { setup: {}, featureType: 'whatsapp_embedded_signup', sessionInfoVersion: '3' },
      },
    );
  }

  const complete = useMutation({
    mutationFn: () =>
      api<{ id: string }>('/whatsapp/embedded-signup/complete', {
        method: 'POST',
        json: {
          code: signupResult?.code,
          wabaId: signupResult?.wabaId ?? manualWaba,
          phoneNumberId: signupResult?.phoneNumberId ?? manualPhoneId,
        },
      }),
    onSuccess: () => router.push('/dashboard/settings'),
  });

  return (
    <div className="h-full overflow-auto p-6">
      {cfg?.enabled && (
        <Script
          src={`https://connect.facebook.net/en_US/sdk.js`}
          strategy="afterInteractive"
          onLoad={() => {
            const init = () => {
              window.FB?.init({
                appId: cfg.appId,
                cookie: true,
                xfbml: true,
                version: cfg.graphVersion,
              });
            };
            if (window.FB) init();
            else window.fbAsyncInit = init;
          }}
        />
      )}

      <h1 className="mb-2 text-2xl font-semibold">Connect WhatsApp</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Use Meta's official Embedded Signup to connect a WhatsApp Business number in 60 seconds.
        No bans, no manual API key juggling.
      </p>

      {!cfg?.enabled && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm">
          Embedded signup isn't configured. Set <code>META_APP_ID</code>,{' '}
          <code>META_APP_SECRET</code>, and <code>META_EMBEDDED_SIGNUP_CONFIG_ID</code> in your
          deployment to enable the one-click flow. You can still connect a number by entering
          credentials manually below.
        </div>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-md border border-border p-4">
          <h2 className="font-semibold">One-click (recommended)</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Sign in with Facebook. Pick or create your WhatsApp Business Account. Done.
          </p>
          <Button
            className="mt-4 w-full"
            onClick={launchSignup}
            disabled={!cfg?.enabled}
          >
            Connect with Meta
          </Button>
          {signupResult?.error && (
            <p className="mt-2 text-xs text-red-600">{signupResult.error}</p>
          )}
          {signupResult?.code && (
            <div className="mt-3 rounded-md bg-muted/30 p-3 text-xs">
              <div>✓ Auth code received</div>
              <div>{signupResult.wabaId ? '✓' : '…'} WABA: {signupResult.wabaId ?? 'pending'}</div>
              <div>{signupResult.phoneNumberId ? '✓' : '…'} Phone ID: {signupResult.phoneNumberId ?? 'pending'}</div>
              <Button
                size="sm"
                className="mt-2 w-full"
                disabled={!signupResult.code || !signupResult.wabaId || !signupResult.phoneNumberId || complete.isPending}
                onClick={() => complete.mutate()}
              >
                {complete.isPending ? 'Provisioning…' : 'Finish'}
              </Button>
            </div>
          )}
        </div>

        <div className="rounded-md border border-border p-4">
          <h2 className="font-semibold">Manual (advanced)</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            If you already have a WABA + phone number ID + system user token, provide them here.
          </p>
          <div className="mt-3 space-y-2">
            <Input placeholder="WABA ID" value={manualWaba} onChange={(e) => setManualWaba(e.target.value)} />
            <Input placeholder="Phone Number ID" value={manualPhoneId} onChange={(e) => setManualPhoneId(e.target.value)} />
            <p className="text-xs text-muted-foreground">
              Use the regular <a href="/dashboard/settings" className="underline">Settings → WhatsApp accounts</a> page
              to provide the access token securely.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
