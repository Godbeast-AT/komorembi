"use client";

import { useEffect, useMemo, useState } from "react";
import { Device } from "@capacitor/device";

import { createBootState } from "@/lib/appReadiness.mjs";
import { createPermanentBanMessage, createTemporaryBanMessage } from "@/lib/reportsSafety.mjs";
import { supabase } from "@/services/supabase";

type UseAppBootOptions = {
  sessionReady: boolean;
  isAuthenticated: boolean;
};

export function useAppBoot({ sessionReady, isAuthenticated }: UseAppBootOptions) {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [isBanned, setIsBanned] = useState(false);
  const [banMessage, setBanMessage] = useState<string | null>(null);
  const [bootTimedOut, setBootTimedOut] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setBootTimedOut(true);
    }, 2500);

    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const checkSecurity = async () => {
      try {
        const info = await Device.getId();
        if (cancelled) return;

        setDeviceId(info.identifier);

        const { data: banData } = await supabase
          .from("banned_devices")
          .select("device_id")
          .eq("device_id", info.identifier)
          .single();

        if (!cancelled && banData) {
          setIsBanned(true);
          setBanMessage("This device has been permanently flagged for violating community safety guidelines.");
        }
      } catch (err) {
        console.warn("Security check limited (not native environment?)", err);
      }
    };

    void checkSecurity();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;

    const checkAccountBan = async () => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("is_banned, account_banned_until, ban_level, ban_reason")
          .maybeSingle();

        if (cancelled || !data?.is_banned) return;

        setIsBanned(true);
        setBanMessage(
          data.ban_reason ||
          (data.ban_level === "report_30_permanent"
            ? createPermanentBanMessage()
            : createTemporaryBanMessage(data.account_banned_until)),
        );
      } catch (err) {
        console.warn("Account ban check limited", err);
      }
    };

    void checkAccountBan();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const boot = useMemo(
    () =>
      createBootState({
        authResolved: sessionReady,
        sessionResolved: sessionReady,
        bootTimedOut,
        isBanned,
      }),
    [sessionReady, isBanned, bootTimedOut],
  );

  return {
    ...boot,
    deviceId,
    isBanned,
    banMessage,
    isAuthenticated,
  };
}
