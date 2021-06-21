const fs = require("fs");

const axios = require("axios");
const axiosCookieJarSupport = require("axios-cookiejar-support").default;
const tough = require("tough-cookie");
const cheerio = require("cheerio");
let Parser = require("rss-parser");
const { createCanvas, loadImage } = require("canvas");
const slugify = require("slugify");

axiosCookieJarSupport(axios);

const cookieJar = new tough.CookieJar();

const url =
  "https://www.journals.uchicago.edu/action/showFeed?type=etoc&feed=rss&jc=phos";

let parser = new Parser();

async function getFeed() {
  let { items } = await parser.parseURL(url);
  items.shift();
  return items;
}

async function formatData() {
  const data = await getFeed();
  const articles = data.map((item) => {
    const article = new Article(item);
    // createThumbs(article);
    return article;
  });

  return articles;
}

function parseContentSnippet(snippet) {
  const arr = snippet.split(",");
  return {
    volume: arr[1].trim().replace(/\D/g, ""),
    issue: arr[2].trim().replace(/\D/g, ""),
    pages: arr[3].trim().replace("Page ", ""),
    date: arr[4].trim().replace(".", ""),
  };
}

class Article {
  constructor(item) {
    this.creator = item.creator;
    this.title = item.title.replace(/,$/, "");
    this.link = item.link;
    this.parsed = parseContentSnippet(item.contentSnippet);
    this.date = this.parsed.date;
    this.volume = this.parsed.volume;
    this.pages = this.parsed.pages;
    this.issue = this.parsed.issue;
    this.image = `/img/${slugify(this.title, { lower: true })}.png`;
  }
}

const articles = formatData();

module.exports = articles;

function createThumbs(data) {
  const canvas = createCanvas(1600, 900);
  const ctx = canvas.getContext("2d");
  const title = data.title;

  const mid = Math.round(title.length / 2);
  const breakSpot = title.indexOf(" ", mid);
  const top = title.substring(0, breakSpot).trim();
  const bottom = title.substring(breakSpot).trim();
  console.log(mid, top, bottom);
  const creator = data.creator;
  const slug = slugify(data.title, { lower: true });

  const pubDate = `Volume ${data.volume}, no. ${data.issue} (${data.date}): ${data.pages}`;
  loadImage("./_data/template.png").then((image) => {
    ctx.drawImage(image, 0, 0, 1600, 900);

    ctx.font = "bold 40px Inter";
    ctx.fillStyle = "#000";
    ctx.fillText(top, 500, 350, 1000);

    ctx.font = "bold 40px Inter";
    ctx.fillStyle = "#000";
    ctx.fillText(bottom, 500, 400, 1000);

    ctx.font = "30px Inter";
    ctx.fillStyle = "#111";
    ctx.fillText(creator, 500, 450);

    ctx.font = "light 20px Inter";
    ctx.fillStyle = "#222";
    ctx.fillText(pubDate, 500, 550);

    const buffer = canvas.toBuffer("image/png");
    fs.writeFileSync(`./_site/img/${slug}.png`, buffer);
  });
}

async function getAbstract(url) {
  const { data } = await axios.get(url, {
    jar: cookieJar,
    withCredentials: true,
  });
  fs.writeFileSync("./text.html", data);
  const selector = cheerio.load(data);
  const abstract = selector(".abstractSection.abstractInFull > p").text();
  return abstract;
}

getAbstract("https://www.journals.uchicago.edu/doi/abs/10.1086/712883");
// getAbstract("https://ryanfeigenbaum.com/");
