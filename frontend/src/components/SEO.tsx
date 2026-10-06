import { useEffect } from "react";

interface SEOProps {
  title: string;
  description?: string;
  noindex?: boolean;
  canonical?: string;
  structuredData?: Record<string, any>;
}

export default function SEO({
  title,
  description = "AI-assisted MSME credit risk decision support platform analyzing business, financial, and alternative data with explainable AI and human-in-the-loop analyst review.",
  noindex = false,
  canonical = "https://msme-risk-ai.vercel.app/",
  structuredData,
}: SEOProps) {
  useEffect(() => {
    // 1. Title tag
    const fullTitle = title.includes("MSME Risk AI")
      ? title
      : `${title} | MSME Risk AI`;
    document.title = fullTitle;

    // Helper to set/create meta tag
    const setMetaTag = (attribute: string, attrValue: string, content: string) => {
      let el = document.querySelector(`meta[${attribute}="${attrValue}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attribute, attrValue);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };

    // 2. Meta description
    setMetaTag("name", "description", description);

    // 3. Robots meta tag (noindex, nofollow for private authenticated pages)
    setMetaTag("name", "robots", noindex ? "noindex, nofollow" : "index, follow");

    // 4. OpenGraph tags
    setMetaTag("property", "og:title", fullTitle);
    setMetaTag("property", "og:description", description);
    setMetaTag("property", "og:type", "website");
    setMetaTag("property", "og:url", canonical);
    setMetaTag("property", "og:site_name", "MSME Risk AI");

    // 5. Twitter Card tags
    setMetaTag("name", "twitter:card", "summary_large_image");
    setMetaTag("name", "twitter:title", fullTitle);
    setMetaTag("name", "twitter:description", description);

    // 6. Canonical link
    if (canonical) {
      let linkCanonical = document.querySelector('link[rel="canonical"]');
      if (!linkCanonical) {
        linkCanonical = document.createElement("link");
        linkCanonical.setAttribute("rel", "canonical");
        document.head.appendChild(linkCanonical);
      }
      linkCanonical.setAttribute("href", canonical);
    }

    // 7. JSON-LD Structured Data
    const defaultJsonLd = structuredData || {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      "name": "MSME Risk AI",
      "applicationCategory": "FinanceApplication",
      "operatingSystem": "All",
      "description": description,
      "url": canonical,
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD"
      },
      "creator": {
        "@type": "Organization",
        "name": "MSME Risk AI Platform",
        "url": "https://msme-risk-ai.vercel.app"
      }
    };

    let scriptLd = document.getElementById("json-ld-schema");
    if (!scriptLd) {
      scriptLd = document.createElement("script");
      scriptLd.id = "json-ld-schema";
      scriptLd.setAttribute("type", "application/ld+json");
      document.head.appendChild(scriptLd);
    }
    scriptLd.textContent = JSON.stringify(defaultJsonLd);
  }, [title, description, noindex, canonical, structuredData]);

  return null;
}
