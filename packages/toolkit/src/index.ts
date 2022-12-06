import * as kons from "kons";
import * as konsola from "kons/consola";
import colors from "picocolors";
import spinner from "ora";
import open from "open";
import progress from "cli-progress";
import columns from "terminal-columns";
import link from "terminal-link";
import Table from "cli-table3";
import prompt from "prompts";
import { execa as exec } from "execa";

export const Toolkit = {
  exec,
  prompt,
  colors,
  spinner,
  open,
  progress,
  columns,
  link,
  kons,
  konsola,
  Table,
};
