// require("dotenv").config();

// const express = require("express");
// const serverless = require("serverless-http");

// const axios = require("axios");
// const multer = require("multer");
// const FormData = require("form-data");
// const fs = require("fs");

// const app = express();

// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));
// app.use(express.static("public"));

// const waitingRequests = new Map();

// /**
//  * File upload temp storage
//  */
// const upload = multer({
//   dest: "/tmp/",
// });

// /**
//  * START API
//  */
// app.post("/start", async (req, res) => {
//   try {
//     const { phone, request_id } = req.body;

//     const callback_url = req.headers["callbackurl"];
//     const token = req.headers["token"];

//     console.log("Start called:", {
//       phone,
//       request_id,
//       callback_url,
//     });

//     /**
//      * Twilio API URL
//      */
//     const url = `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`;

//     /**
//      * Form URL
//      */
//     const formLink = `${process.env.APP_BASE_URL}/form.html?request_id=${request_id}`;

//     /**
//      * SEND MESSAGE
//      */
//     console.log(process.env.TWILIO_AUTH_TOKEN);
//     await axios.post(
//   url,
//   new URLSearchParams({
//     From: process.env.TWILIO_FROM_NUMBER,
//     To: phone,
//     Body: `Please fill this form and upload image: ${formLink}`,
//   }),
//   {
//     headers: {
//       "Content-Type":
//         "application/x-www-form-urlencoded",

//       Authorization:
//         process.env.TWILIO_AUTH_TOKEN,
//     },
//   }
// );

//     console.log("Message sent successfully");

//     /**
//      * WAIT FOR FORM SUBMISSION
//      */
//     let resolveFn;

//     const waitPromise = new Promise((resolve) => {
//       resolveFn = resolve;
//     });

//     waitingRequests.set(request_id, resolveFn);

//     console.log(
//       "Waiting for form submission..."
//     );

//     /**
//      * WAIT HERE UNTIL FORM IS SUBMITTED
//      */
//     const userData = await waitPromise;

//     console.log(
//       "Received analyzed response:",
//       userData
//     );

//     /**
//      * CALLBACK PAYLOAD
//      */
//     const finalMsg = {
//       request_id,
//       status: "COMPLETED",
//       data: userData,
//     };

//     /**
//      * SEND CALLBACK
//      */
//     if (callback_url) {
//       try {
//         const galeResponse = await axios.post(
//           callback_url,
//           finalMsg,
//           {
//             headers: {
//               Accept: "application/json",
//               Authorization: token,
//             },
//           }
//         );

//         console.log(
//           "Callback sent successfully:",
//           galeResponse.status
//         );
//       } catch (err) {
//         console.error(
//           "Callback failed:",
//           err.response?.data || err.message
//         );
//       }
//     }

//     res.json({
//       status: "CALLBACK_TRIGGERED",
//       request_id,
//       data: userData,
//     });

//   } catch (err) {
//     console.error(err);

//     res.status(500).json({
//       error: err.message,
//     });
//   }
// });

// /**
//  * FORM SUBMISSION
//  */
// app.post(
//   "/submit-form",
//   upload.single("image"),
//   async (req, res) => {
//     try {
//       const {
//         request_id,
//         name,
//         age,
//         problem,
//       } = req.body;

//       console.log("Form received:", {
//         request_id,
//         name,
//         age,
//         problem,
//       });

//       /**
//        * VALIDATE FILE
//        */
//       if (!req.file) {
//         return res.status(400).send(
//           "No image uploaded"
//         );
//       }

//       console.log(
//         "Uploaded file:",
//         req.file.originalname
//       );

//       /**
//        * STEP 1
//        * Upload image to Kore file server
//        */

//       const form = new FormData();

//       form.append(
//         "file",
//         fs.createReadStream(req.file.path),
//         req.file.originalname
//       );

//       console.log(
//         "Uploading image to Kore server..."
//       );

//       const uploadResponse = await axios.post(
//         process.env.KORE_UPLOAD_URL,
//         form,
//         {
//           headers: form.getHeaders(),
//         }
//       );

//       console.log(
//         "Kore upload response:",
//         uploadResponse.data
//       );

//       /**
//        * IMPORTANT
//        * Adjust this according to actual response
//        */
//       const imageUrl =
//         uploadResponse.data.url ||
//         uploadResponse.data.file ||
//         uploadResponse.data.path ||
//         uploadResponse.data;

//       if (!imageUrl) {
//         throw new Error(
//           "Image URL not received from upload API"
//         );
//       }

//       console.log(
//         "Uploaded Image URL:",
//         imageUrl
//       );

//       /**
//        * STEP 2
//        * Analyze image using OpenAI Vision
//        */

//       console.log(
//         "Calling OpenAI Vision API..."
//       );

//       const aiResponse = await fetch(
//         "https://api.openai.com/v1/responses",
//         {
//           method: "POST",
//           headers: {
//             Authorization:
//               `Bearer ${process.env.OPENAI_API_KEY}`,
//             "Content-Type":
//               "application/json",
//           },

//           body: JSON.stringify({
//             model: "gpt-4.1-mini",

//             input: [
//               {
//                 role: "user",

//                 content: [
//                   {
//                     type: "input_text",

//                     text:
//                       "Check if this plant is damaged or healthy. Respond ONLY in JSON format with fields: status and reason.",
//                   },

//                   {
//                     type: "input_image",
//                     image_url: imageUrl,
//                   },
//                 ],
//               },
//             ],
//           }),
//         }
//       );

//       const aiData = await aiResponse.json();

//       console.log(
//         "OpenAI raw response:",
//         JSON.stringify(aiData, null, 2)
//       );

//       /**
//        * STEP 3
//        * Extract response text
//        */

//       const outputText =
//         aiData?.output?.[0]?.content?.[0]?.text;

//       console.log(
//         "Model Output:",
//         outputText
//       );

//       let parsedResponse;

//       try {
//         parsedResponse =
//           JSON.parse(outputText);
//       } catch (e) {
//         parsedResponse = {
//           raw: outputText,
//         };
//       }

//       /**
//        * FINAL OBJECT
//        */

//       const finalResponse = {
//         name,
//         age,
//         problem,
//         imageUrl,
//         analysis: parsedResponse,
//       };

//       console.log(
//         "Final Response:",
//         finalResponse
//       );

//       /**
//        * STEP 4
//        * Resolve waiting request
//        */

//       if (
//         waitingRequests.has(request_id)
//       ) {
//         const resolveFn =
//           waitingRequests.get(request_id);

//         resolveFn(finalResponse);

//         waitingRequests.delete(
//           request_id
//         );
//       }

//       /**
//        * CLEANUP LOCAL FILE
//        */

//       fs.unlinkSync(req.file.path);

//       /**
//        * RESPONSE TO USER
//        */

//       res.send(`
//         <html>
//           <body style="font-family: Arial; padding: 40px;">
//             <h2>
//               Form submitted successfully.
//             </h2>

//             <p>
//               Image analyzed successfully.
//             </p>

//             <p>
//               You can now close this page.
//             </p>
//           </body>
//         </html>
//       `);

//     } catch (err) {
//       console.error(
//         "Submit Form Error:",
//         err
//       );

//       res.status(500).send(`
//         <h2>Error occurred</h2>
//         <pre>${err.message}</pre>
//       `);
//     }
//   }
// );

// /**
//  * HEALTH CHECK
//  */
// app.get("/", (req, res) => {
//   res.send("Server is running");
// });

// /**
//  * EXPORT FOR AWS LAMBDA
//  */
// app.listen(3000, () => {
//   console.log(
//     "Server running on http://localhost:3000"
//   );
// });

require("dotenv").config();

const express = require("express");
const axios = require("axios");
const multer = require("multer");
const FormData = require("form-data");
const fs = require("fs");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

/**
 * Store waiting requests
 */
const waitingRequests = new Map();

/**
 * Multer temp storage
 */
const upload = multer({
  dest: "/tmp/",
});

/**
 * START API
 */
app.post("/start", async (req, res) => {
  try {
    const { phone, request_id } = req.body;

    const callback_url =
      req.headers["callbackurl"];

    const token =
      req.headers["token"];

    console.log("Start called:", {
      phone,
      request_id,
      callback_url,
    });

    /**
     * Twilio API URL
     */
    const twilioUrl =
      `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`;

    /**
     * Form URL
     */
    const formLink =
      `${process.env.APP_BASE_URL}/form.html?request_id=${request_id}`;

    /**
     * Send WhatsApp/SMS
     */
    await axios.post(
      twilioUrl,

      new URLSearchParams({
        From:
          process.env.TWILIO_FROM_NUMBER,

        To: phone,

        Body:
          `Please fill this form and upload plant images:\n${formLink}`,
      }),

      {
        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",

          Authorization:
            process.env.TWILIO_AUTH_TOKEN,
        },
      }
    );

    console.log(
      "Message sent successfully"
    );

    /**
     * Wait for form submission
     */
    let resolveFn;

    const waitPromise =
      new Promise((resolve) => {
        resolveFn = resolve;
      });

    waitingRequests.set(
      request_id,
      resolveFn
    );

    console.log(
      "Waiting for form submission..."
    );

    /**
     * Wait here
     */
    const userData =
      await waitPromise;

    console.log(
      "Received final response:",
      userData
    );

    /**
     * Final callback payload
     */
    const finalMsg = {
      request_id,
      status: "COMPLETED",
      data: userData,
    };

    /**
     * Send callback
     */
    if (callback_url) {
      try {
        const callbackResponse =
          await axios.post(
            callback_url,
            finalMsg,
            {
              headers: {
                Accept:
                  "application/json",

                Authorization:
                  token,
              },
            }
          );

        console.log(
          "Callback success:",
          callbackResponse.status
        );

      } catch (err) {

        console.error(
          "Callback failed:",
          err.response?.data ||
            err.message
        );
      }
    }

    res.json({
      status:
        "CALLBACK_TRIGGERED",

      request_id,

      data: userData,
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: err.message,
    });
  }
});

/**
 * FORM SUBMISSION
 * MULTIPLE IMAGE SUPPORT
 */
app.post(
  "/submit-form",

  upload.array("images", 10),

  async (req, res) => {

    try {

      const {
        request_id,
        name,
        age,
        problem,
      } = req.body;

      console.log(
        "Form received:",
        {
          request_id,
          name,
          age,
          problem,
        }
      );

      /**
       * Validate images
       */
      if (
        !req.files ||
        req.files.length === 0
      ) {
        return res
          .status(400)
          .send(
            "No images uploaded"
          );
      }

      console.log(
        `Received ${req.files.length} images`
      );

      /**
       * Upload all images
       */
      const uploadedImages = [];

      // for (const file of req.files) {

      //   console.log(
      //     "Uploading:",
      //     file.originalname
      //   );

      //   const form =
      //     new FormData();

      //   form.append(
      //     "file",
      //     fs.createReadStream(
      //       file.path
      //     ),
      //     file.originalname
      //   );

      //   const uploadResponse =
      //     await axios.post(
      //       process.env
      //         .KORE_UPLOAD_URL,

      //       form,

      //       {
      //         headers:
      //           form.getHeaders(),
      //       }
      //     );

      //   console.log(
      //     "Upload response:",
      //     uploadResponse.data
      //   );

      //   const imageUrl =
      //     uploadResponse.data.url ||
      //     uploadResponse.data.file ||
      //     uploadResponse.data.path ||
      //     uploadResponse.data;

      //   if (!imageUrl) {
      //     throw new Error(
      //       `Image URL not received for ${file.originalname}`
      //     );
      //   }

      //   uploadedImages.push({
      //     fileName:
      //       file.originalname,

      //     imageUrl,
      //   });
      // }
for (let i = 0; i < req.files.length; i++) {

  const file = req.files[i];

  /**
   * Create custom filename
   */
  const timestamp =
    Date.now();

  const extension =
    file.originalname
      .split(".")
      .pop();

  const newFileName =
    `${timestamp}_${i + 1}.${extension}`;

  console.log(
    "Uploading as:",
    newFileName
  );

  const form =
    new FormData();

  /**
   * Upload using new filename
   */
  form.append(
    "file",
    fs.createReadStream(
      file.path
    ),
    newFileName
  );

  const uploadResponse =
    await axios.post(
      process.env
        .KORE_UPLOAD_URL,

      form,

      {
        headers:
          form.getHeaders(),
      }
    );

  console.log(
    "Upload response:",
    uploadResponse.data
  );

  const imageUrl =
    uploadResponse.data.url ||
    uploadResponse.data.file ||
    uploadResponse.data.path ||
    uploadResponse.data;

  if (!imageUrl) {

    throw new Error(
      `Image URL not received for ${newFileName}`
    );
  }

  uploadedImages.push({
    fileName:
      newFileName,

    imageUrl,
  });
}
      console.log(
        "All images uploaded:",
        uploadedImages
      );

      /**
       * Build OpenAI content
       */
      const content = [
        {
          type: "input_text",

          text:
            "Analyze all uploaded plant images. " +
            "For each image identify whether the plant is healthy or damaged. " +
            "Return ONLY JSON array format with fields: image, status, reason.",
        },
      ];

      /**
       * Add all images
       */
      uploadedImages.forEach(
        (img) => {

          content.push({
            type: "input_image",

            image_url:
              img.imageUrl,
          });
        }
      );

      console.log(
        "Calling OpenAI Vision..."
      );

      /**
       * OpenAI Vision API
       */
      const aiResponse =
        await fetch(
          "https://api.openai.com/v1/responses",

          {
            method: "POST",

            headers: {
              Authorization:
                `Bearer ${process.env.OPENAI_API_KEY}`,

              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              model:
                "gpt-4.1-mini",

              input: [
                {
                  role: "user",

                  content,
                },
              ],
            }),
          }
        );

      const aiData =
        await aiResponse.json();

      console.log(
        "OpenAI raw response:",
        JSON.stringify(
          aiData,
          null,
          2
        )
      );

      /**
       * Extract model text
       */
      const outputText =
        aiData?.output?.[0]
          ?.content?.[0]?.text;

      console.log(
        "Model Output:",
        outputText
      );

      /**
       * Parse AI response
       */
      let parsedResponse;

      try {

        parsedResponse =
          JSON.parse(outputText);

      } catch (e) {

        parsedResponse = {
          raw: outputText,
        };
      }

      /**
       * Final object
       */
      const finalResponse = {
        name,
        age,
        problem,

        images:
          uploadedImages,

        analysis:
          parsedResponse,
      };

      console.log(
        "Final Response:",
        JSON.stringify(
          finalResponse,
          null,
          2
        )
      );

      /**
       * Resolve waiting request
       */
      if (
        waitingRequests.has(
          request_id
        )
      ) {

        const resolveFn =
          waitingRequests.get(
            request_id
          );

        resolveFn(
          finalResponse
        );

        waitingRequests.delete(
          request_id
        );
      }

      /**
       * Cleanup temp files
       */
      for (const file of req.files) {

        try {

          fs.unlinkSync(
            file.path
          );

        } catch (cleanupErr) {

          console.error(
            "Cleanup error:",
            cleanupErr.message
          );
        }
      }

      /**
       * Success HTML
       */
      res.send(`
        <html>
          <body style="font-family: Arial; padding: 40px;">
            
            <h2>
              Form submitted successfully.
            </h2>

            <p>
              ${req.files.length} image(s) analyzed successfully.
            </p>

            <p>
              You can now close this page.
            </p>

          </body>
        </html>
      `);

    } catch (err) {

      console.error(
        "Submit Form Error:",
        err
      );

      res.status(500).send(`
        <h2>Error occurred</h2>
        <pre>${err.message}</pre>
      `);
    }
  }
);

/**
 * HEALTH CHECK
 */
app.get("/", (req, res) => {

  res.send(
    "Server is running"
  );
});

/**
 * START SERVER
 */
app.listen(3000, () => {

  console.log(
    "Server running on http://localhost:3000"
  );
});
