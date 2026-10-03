import { Link, Meta, Title } from "@solidjs/meta";
import { SITE_DESCRIPTION, SITE_TITLE, SITE_URL } from "~/consts";

/** 페이지마다 title·description·canonical·OG 를 선언한다. 서버는 <head> 에 그대로 넣고, 클라이언트는 이동할 때 자동으로 바꿔 준다. */
export default function PageHead(props: { title?: string; description?: string; path: string; type?: "website" | "article"; noindex?: boolean }) {
  const title = () => (props.title ? `${props.title} | ${SITE_TITLE}` : SITE_TITLE);
  const description = () => props.description ?? SITE_DESCRIPTION;
  const url = () => `${SITE_URL}${props.path === "/" ? "" : props.path}`;
  return (
    <>
      <Title>{title()}</Title>
      <Meta name="description" content={description()} />
      <Link rel="canonical" href={url()} />
      <Meta property="og:type" content={props.type ?? "website"} />
      <Meta property="og:site_name" content={SITE_TITLE} />
      <Meta property="og:title" content={title()} />
      <Meta property="og:description" content={description()} />
      <Meta property="og:url" content={url()} />
      <Meta name="twitter:card" content="summary" />
      <Meta name="robots" content={props.noindex ? "noindex" : "index,follow"} />
    </>
  );
}
