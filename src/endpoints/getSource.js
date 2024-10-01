const fs = require('fs').promises;
const path = require('path');

function getSource({ url, proxy }) {
    return new Promise(async (resolve, reject) => {
        if (!url) return reject('Missing url parameter')
        const context = await global.browser.createBrowserContext().catch(() => null);
        if (!context) return reject('Failed to create browser context')

        let isResolved = false

        const { proxyRequest } = await import('puppeteer-proxy')

        var cl = setTimeout(async () => {
            if (!isResolved) {
                await context.close()
                reject("Timeout Error")
            }
        }, (global.timeOut || 60000))

        try {
            const page = await context.newPage();
            await page.setRequestInterception(true);
            page.on('request', async (request) => {
                try {
                    if (proxy) {
                        await proxyRequest({
                            page,
                            proxyUrl: `http://${proxy.username ? `${proxy.username}:${proxy.password}@` : ""}${proxy.host}:${proxy.port}`,
                            request,
                        });
                    } else {
                        request.continue()
                    }
                } catch (e) { }
            });
            page.on('response', async (res) => {
                try {
                    if ([200, 302].includes(res.status()) && [url, url + '/'].includes(res.url())) {
                        await page.waitForNavigation({ waitUntil: 'load', timeout: 5000 }).catch(() => { });
                        const allCookies = await page.cookies();
                        const userAgent = await page.evaluate(() => navigator.userAgent);
                        const relevantCookies = allCookies.filter(cookie => cookie.name === 'cf_clearance');
                        await context.close();
                        isResolved = true;
                        clearInterval(cl);
                        resolve({ userAgent, cookies: relevantCookies });
                    }
                } catch (e) { 
                    console.error('Error retrieving cookies:', e);
                }
            })
            await page.goto(url, {
                waitUntil: 'domcontentloaded'
            })
        } catch (e) {
            if (!isResolved) {
                await context.close()
                clearInterval(cl)
                reject(e.message)
            }
        }
    })
}

module.exports = getSource