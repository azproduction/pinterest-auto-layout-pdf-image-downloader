# Pinterest board image downloader and auto-layout pdf generator

It accepts Pinterest galley URL, downloads all the images in high res 
from the gallery, automatically generates pdf and html document with nicely
layed out pictures using justified-layout from Flickr.


## Installation

Clone the repo and run `yarn install`

```
node index.js [options]

Options:
  --output [dir]  Directory to download pictures and files to
  --url [url]     Pinterest board URL
  -h, --help      output usage information
```

## Examples

```
node index.js --output board-name --url https://www.pinterest.com/you/board-name/
```

```
node index.js --output kda-shooting-reference --url https://www.pinterest.com/azproduction/kda-shooting-reference/
```
