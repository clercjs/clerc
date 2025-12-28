import type { PartialRequired } from "@clerc/utils";
import type {
  NotifyOptions,
  Settings as NotifierSettings,
  UpdateNotifier,
} from "update-notifier";

export type CustomMessage = string | ((notifier: UpdateNotifier) => string);

export type EnhancedNotifierSettings = PartialRequired<NotifierSettings, "pkg">;

export type EnhancedNotifyOptions = Omit<NotifyOptions, "message"> & {
  message?: CustomMessage;
};
