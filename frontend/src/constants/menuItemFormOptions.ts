export type LocalOption = {
  id: string;
  name: string;
};

export const DEFAULT_COOKING_METHODS: LocalOption[] = [
  { id: "xao-me", name: "Xào me" },
  { id: "nuong-moi", name: "Nướng mọi" },
  { id: "nuong-pho-mai", name: "Nướng phô mai" },
  { id: "luoc", name: "Luộc" },
  { id: "xao-bo", name: "Xào bơ" },
  { id: "rang-muoi", name: "Rang muối" },
  { id: "nuong-muoi-ot", name: "Nướng muối ớt" },
  { id: "nuong-mo-hanh", name: "Nướng mỡ hành" },
  { id: "xao-trung-muoi", name: "Xào trứng muối" },
  { id: "hap-sa", name: "Hấp sả" },
  { id: "hap-thai", name: "Hấp thái" },
  { id: "xao-mi", name: "Xào mì" },
  { id: "xao-rau-muong", name: "Xào rau muống" },
];

export const DEFAULT_MENU_ITEM_UNITS: LocalOption[] = [
  { id: "phan", name: "phần" },
  { id: "con", name: "con" },
  { id: "dia", name: "dĩa" },
  { id: "to", name: "tô" },
  { id: "trung", name: "trứng" },
  { id: "cang", name: "càng" },
  { id: "goi", name: "gói" },
  { id: "ly", name: "ly" },
  { id: "lon", name: "lon" },
];
