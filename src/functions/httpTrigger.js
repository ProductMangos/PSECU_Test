const { app } = require('@azure/functions');
const { chromium } = require('playwright-chromium');
const appInsights = require('applicationinsights');
const { v4: uuidv4 } = require('uuid');

appInsights.setup(process.env["APPINSIGHTS_INSTRUMENTATIONKEY"])
    .setAutoDependencyCorrelation(true)
    .setAutoCollectRequests(true)
    .setAutoCollectPerformance(true, true)
    .setAutoCollectExceptions(true)
    .setAutoCollectDependencies(true)
    .setAutoCollectConsole(true)
    .setUseDiskRetryCaching(true)
    .setSendLiveMetrics(false)
    .start();

const client = appInsights.defaultClient;


app.timer('timerTrigger', {
    schedule: '0 */5 * * * *',
    handler: async (myTimer, context) => {
        const uniqueId = uuidv4();
        const startTime = new Date();
        const testStartTimer = new Date();

        try {
            const browser = await chromium.launch();
            const browserContext = await browser.newContext({
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36'
            });
            const page = await browserContext.newPage();   

            const responses = [];

            page.on('response', response => {
                responses.push({
                    url: response.url(),
                    status: response.status(),
                    headers: response.headers(),
                    timestamp: new Date().toISOString()
                });
            });

            await navigateAndPerformActions(page, context, responses, true, startTime, testStartTimer, uniqueId);
            await browser.close();
            context.log("Successfully closed the browser");

        } catch (error) {
            const errorMessage = error.message || 'Unknown error';
            context.log(`Failed to access the website: ${errorMessage}`);

            client.trackAvailability({
                id: uniqueId,
                name: "Temenos",
                success: false,
                message: `Failed to navigate: ${errorMessage}`,
                runLocation: "East US"
            });

            throw error;
        }
    }
});

async function navigateAndPerformActions(page, context, responses, success, startTime, testStartTimer, uniqueId) {
    const urls = {
        resumePage: "https://www.psecu.com/resume-application",
        productPage: "https://apps.psecu.com/virtualcapture/Products",
        loginPage: "https://app.psecu.com/MemberAuthenticationWebV1/Login.aspx?AppType=Status",
        listAppsPage: "https://apps.psecu.com/virtualcapture/ListApplication",
        signOutPage: "https://apps.psecu.com/virtualcapture/default/Login/SignOut",
    };

    try {
        await page.goto(urls.resumePage);
        context.log("Navigated to Resume Application page");
        client.trackPageView({ 
            name: "PSECU Resume Application Page", 
            url: urls.resumePage,
            id: uniqueId
         });
//
        // Navigate to product page
        await page.goto(urls.productPage);
        context.log("Navigated to Products page");
        client.trackPageView({ 
            name: "Temenos Product Page", 
            url: urls.productPage,
            id: uniqueId
         });

        // Navigate to login page
        await page.goto(urls.loginPage);
        context.log("Navigated to Login page");
        client.trackPageView({ 
            name: "Temenos Login Page", 
            url: urls.loginPage,
            id: uniqueId
        });

        // Perform login actions (assuming login success)
        await page.getByLabel("User ID or Account Number:").fill(process.env["USER_ID"]);
        context.log("Successfully entered account number");
        await page.getByLabel("Password:").click();
        context.log("Successfully clicked on password input box");
        await page.waitForTimeout(500);
        await page.getByLabel("PIN:").fill(process.env["USER_PIN"]);
        context.log("Successfully entered pin number");
        await page.locator("id=ctl00_ctl00_MainContent_MainContent_btnLogin").click();
        context.log("Successfully clicked on login button");

        // Navigate to list apps page
        await page.goto(urls.listAppsPage);
        context.log("Navigated to List Applications page");
        client.trackPageView({ 
            name: "Temenos Application List Page", 
            url: urls.listAppsPage,
            id: uniqueId
        });

        // Perform logout actions
        await page.goto(urls.signOutPage);
        context.log("Navigated to Sign Out page");
        client.trackPageView({ 
            name: "PSECU Sign Out Page", 
            url: urls.signOutPage,
            id: uniqueId
        });

        const endTime = new Date();
        const duration = endTime - startTime;
        const endTestTimer = endTime - testStartTimer;

        client.trackAvailability({
            id: uniqueId,
            name: "Temenos",
            message: "Test Passed",
            success: true,
            duration: duration,
            runLocation: "East US",
            properties: {
                "Total Duration": `${duration}ms`,
                "End-to-End Test Duration": `${endTestTimer}ms`
            }
        });
           

    } catch (error) {
        context.log(`Error navigating and performing actions: ${error}`);
        success = false;
        message = error.message;

        responses.forEach(response => {
            client.trackRequest({
                id: uniqueId,
                url: response.url,
                name: response.url,               
                resultCode: response.status.toString(),
                success: response.status >= 200 && response.status < 400,                      
                duration: response.duration,                   
            });
        })
        
        client.trackAvailability({
            id: uniqueId,
            name: "Temenos",
            message: message,
            success: success,
            runLocation: "East US"
        });

        throw error; 

    }
}