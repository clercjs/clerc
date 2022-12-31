declare module "get-func-name" {
  const getFuncName: (fn: (...args: any[]) => any) => string;
  export default getFuncName;
}