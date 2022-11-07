export const gracefulFlag = (n: string) => n.length === 1 ? `-${n}` : `--${n}`;
