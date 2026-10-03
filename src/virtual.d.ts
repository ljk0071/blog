declare module "virtual:notes" {
  export interface NoteMeta {
    id: string;
    title: string;
    description: string;
    /** YYYY-MM-DD */
    pubDate: string;
    updatedDate?: string;
    tags: string[];
    stage: "seedling" | "budding" | "evergreen";
    draft: boolean;
    minutes: number;
    /** 이 노트 본문이 링크한 다른 노트 id */
    links: string[];
    headings: { depth: 2 | 3; id: string; text: string }[];
  }
  export const notes: NoteMeta[];
}

declare module "virtual:note-bodies" {
  export const bodies: Record<string, () => Promise<{ default: string }>>;
}

declare module "virtual:search-index" {
  const index: { id: string; text: string }[];
  export default index;
}
