import * as kons from "kons";
import * as konsola from "kons/consola";
import colors from "picocolors";
import figures from "figures";
import task from "tasuku";
import spinner from "ora";
import open from "open";
import progress from "cli-progress";
import columns from "terminal-columns";
import link from "terminal-link";
import Table from "cli-table3";
import Enquirer from "enquirer";

const { prompt } = new Enquirer();

export const Toolkit = {
  prompt,
  task,
  figures,
  colors,
  spinner,
  open,
  progress,
  columns,
  link,
  kons,
  konsola,
  Table,
  Enquirer,
};
