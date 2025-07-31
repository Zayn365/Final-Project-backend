const { v4: uuidv4 } = require("uuid");

async function initiateSepaPayment(req, res) {
  try {
    const response = await fetch(
      "https://test.ziraatpay.com.tr/ziraatpay/api/v2/session",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ACTION: "SESSIONTOKEN",
          MERCHANTUSER: "store@bikev.k12.tr",
          MERCHANTPASSWORD: "Bikev1996….",
          MERCHANT: "10009092",
          AMOUNT: 11.21,
          CURRENCY: "TRY",
          MERCHANTPAYMENTID: "PaymentId-FuldmrwwiOpb",
          RETURNURL:
            "https://neon-app.local.payten.com.tr/msu.merchant/index.jsp",
          CUSTOMER: "Customer-jNPz2qSI",
          CUSTOMERNAME: "Name jNPz2qSI",
          CUSTOMEREMAIL: "jNPz2qSI@email.com",
          CUSTOMERIP: "127.0.0.1",
          CUSTOMERUSERAGENT:
            "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/43.0.2357.81 Safari/537.36",
          NAMEONCARD: "Name jNPz2qSI",
          CUSTOMERPHONE: "6381053412",
          ORDERITEMS: [
            {
              productCode: "T00D3AITCC",
              name: "Galaxy Note 3",
              description: "Description of Galaxy Note 3",
              quantity: 2,
              amount: 449.99,
            },
            {
              productCode: "B00D9AVYBM",
              name: "Samsung Galaxy S III",
              description:
                "Samsung Galaxy S III (S3) Triband White (Boost Mobile)",
              quantity: 1,
              amount: 149.95,
            },
            {
              productCode: "B00NQGP5M8",
              name: "Apple iPhone 6",
              description: "Apple iPhone 6, Gold, 64 GB (Unlocked) by Apple",
              quantity: 1,
              amount: 139.95,
            },
            {
              productCode: "B00U8KSUIG",
              name: "Samsung Galaxy S6",
              description:
                "Samsung Galaxy S6 SM-G920F 32GB (FACTORY UNLOCKED) 5.1 QHDBlack-InternationalVersion",
              quantity: 1,
              amount: 129.95,
            },
          ],
          DISCOUNTAMOUNT: 2.5,
          BILLTOADDRESSLINE: "Road",
          BILLTOCITY: "Istanbul",
          BILLTOCOUNTRY: "Turkey",
          BILLTOPOSTALCODE: "1103",
          BILLTOPHONE: "123456789",
          SHIPTOADDRESSLINE: "Road",
          SHIPTOCITY: "Ankara",
          SHIPTOCOUNTRY: "Turkey",
          SHIPTOPOSTALCODE: "1105",
          SHIPTOPHONE: "987654321",
          SESSIONTYPE: "PAYMENTSESSION",
          SELLERID: "seller01;seller02",
          COMMISSIONAMOUNT: "50.55;35.62",
        }),
      }
    );

    const data = await response.text();
    res.json(data); // { sessionToken, responseCode, responseMsg }
  } catch (err) {
    console.error("Error requesting session token:", err);
    res.status(500).json({ error: "Failed to request session token" });
  }
}

module.exports = { initiateSepaPayment };
