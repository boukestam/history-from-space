import { render } from "preact";

const info = document.getElementById('info') as HTMLDivElement;

export function showInfo(title: string, doc: Document) {
  render(<Info title={title} doc={doc} />, info);
}

function Info({title, doc}: {title: string, doc: Document}) {
  return (
    <div class="max-w-[400px] text-white p-4 flex flex-col gap-2">
      <h1 class="text-3xl">{title}</h1>

      {[...doc.childNodes[0].childNodes].flatMap(node => {
        if (node.nodeName === "text") {
          return (node.textContent || "").split("\n").map((line: string, i) => <p key={i}>{line}</p>);
        } else if (node.nodeName === "youtube") {
          const url = node.textContent!.trim();
          const id = url.match(/v=([^&]+)/)![1];

          return (
            <div class="aspect-w-16 aspect-h-9 w-full relative flex justify-center">
              <iframe class="w-full h-full" src={`https://www.youtube-nocookie.com/embed/${id}`} allow="fullscreen; encrypted-media; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" />
            </div>
          );
        } else if (node.nodeName === "wiki") {
          const url = node.textContent!.trim();

          return (
            <div class="">
              <a class="text-blue-500 underline" href={url} target="_blank">{decodeURI(url)}</a>
            </div>
          );
        }
      })}

      <button class="bg-gray-800 text-white p-2 rounded-md mt-8" onClick={() => {
        render(null, info);
      }}>Close</button>
    </div>
  );
}