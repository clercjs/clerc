type Type<T = any> = (value?: any) => T;

export const OneOf = <T>(list: T[], origType: Type<T>) => {
  const stringList = list.join(", ");
  const res = (value: string) => {
    if (!list.includes(origType(value))) {
      throw new Error(`Must be one of the following: ${stringList}`);
    }
    return origType(value);
  };
  Object.defineProperty(res, "name", {
    value: `OneOf: ${stringList}`,
  });
  return res;
};
