type EncodableBaseTypes = boolean | string | number | undefined;

type EncodableArray = Array<EncodableData>;

interface EncodableObject {
  [key: string]: EncodableData;
}

export type EncodableData = EncodableBaseTypes | EncodableArray | EncodableObject;

export interface Encodable<T extends EncodableData> {
  encode(): T;
}

export interface Decodable<T extends EncodableData> {
  new (data: T): Encodable<T>;
}

export function decode<T extends EncodableData>(decodable: Decodable<T>, data: T): Encodable<T> {
  return new decodable(data);
}
