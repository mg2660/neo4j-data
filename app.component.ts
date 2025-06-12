import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
type Intent =
  | 'greeting'
  | 'farewell'
  | 'help'
  | 'structured_event'
  | 'network_command'
  | 'general_query'
  | 'unknown';
const intentKeywords = {
  greeting: ['hi', 'hello', 'hey'],
  farewell: ['bye', 'goodbye', 'see you'],
  help: ['help', 'support', 'assist'],
  network_command: ['show routes', 'get paths', 'network'],
  structured_event: ['organize', 'host', 'plan', 'schedule', 'gaming event', 'tournament', 'match'],
};
function classifyIntent(message: string): Intent {
  const normalized = message.toLowerCase().replace(/\s+/g, ' ').trim();
  for (const [intent, keywords] of Object.entries(intentKeywords)) {
    if (keywords.some(keyword => normalized.includes(keyword))) {
      return intent as Intent;
    }
  }
  if (normalized.length > 10) return 'general_query';
  return 'unknown';
}
async function extractEntitiesWithLLM(userMessage: string): Promise<any> {
  try {
    const payload = {
      model: "mistral-7b-instruct-v0.1.Q3_K_M.gguf",
      messages: [
        {
          role: "system",
          content: "Extract structured details from the user's message about a gaming event. Return a JSON object with keys: eventType, location, startDate, endDate, playerCount."
        },
        {
          role: "user",
          content: userMessage
        }
      ],
      max_tokens: 150,
      temperature: 0.0
    };
    const res = await fetch("http://35.171.185.203:8000/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    return JSON.parse(data.choices?.[0]?.message?.content || '{}');
  } catch (error) {
    console.error("Entity extraction failed:", error);
    return null;
  }
}
@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'DSM';
  chatWindowOpen = false;
  messages: { text: string; sender: string; imageUrl?: string;  }[] = [
    { text: "Hello <Customer name>! I'm your dedicated GameX assistant. How can I assist you, today?", sender: "bot" },
  ];
  newMessage = '';
  apiResponse: any;
  eventDetails: any = {};
  awaitingResponse: string | null = null;
  confirmationShown: boolean = false;
  processing = false;
  //isLoading = false;
  modalImageUrl: string | null = null;
  lessThan500Summary: any[] = [];
  moreThan500Summary: any[] = [];
  //invoiceShown = false;
  previousUserMessage: string = '';
  //eventDetails: any = {};
awaitingMissingFields: boolean = false;
awaitingConfirmation: boolean = false;
awaitingConversionConfirmation: boolean = false;


openImageModal(url: string): void {
  this.modalImageUrl = url;
}

closeImageModal(): void {
  this.modalImageUrl = null;
}



  eventTypeAttempts = 0;
  @ViewChild('chatBody') chatBody!: ElementRef;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.http.get<any[]>('/assets/lessthan500subscribers.json').subscribe(data => {
      this.lessThan500Summary = data;
    });

    this.http.get<any[]>('/assets/morethan500subscribers.json').subscribe(data => {
      this.moreThan500Summary = data;
    });
  }


  scrollUp() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  toggleChatWindow() {
    this.chatWindowOpen = !this.chatWindowOpen;
    setTimeout(() => this.scrollToBottom(), 100);
  }

  async extractEntitiesWithLLM(userMessage: string): Promise<any> {
    const payload = {
      model: "mistral-7b-instruct-v0.1.Q3_K_M.gguf",
      messages: [
        {
          role: "system",
          content: `Extract details ONLY if the user is talking about a *gaming* event.
  Return a JSON with: eventType, location, startDate, endDate, playerCount.
  If it's not a gaming event, respond with: { "eventType": "non-gaming" }`
        },
        {
          role: "user",
          content: userMessage
        }
      ],
      max_tokens: 100,
      temperature: 0.0
    };

    try {
      const res = await fetch("http://35.171.185.203:8000/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      return JSON.parse(content); // Assuming the response is a clean JSON string
    } catch (err) {
      console.error("Entity extraction failed:", err);
      return null;
    }
  }

  async sendMessage(userMessage: string) {
    if (!userMessage.trim()) return;

    this.messages.push({ text: userMessage, sender: "user" });
    //this.userInput='';
    // 💬 Handle confirmation for non-gaming to gaming conversion
    if (this.awaitingConversionConfirmation) {
      if (userMessage.toLowerCase().includes("yes")) {
        this.awaitingConversionConfirmation = false;
        this.messages.push({ text: "✅ Let's convert it to a gaming event! Please provide the event details.", sender: "bot" });
      } else {
        this.awaitingConversionConfirmation = false;
        this.messages.push({ text: "👍 Alright. Let me know if you need help with anything else.", sender: "bot" });
      }
      return;
    }

    // ⏳ Collect missing fields
    if (this.awaitingMissingFields) {
      const newEntities = await this.extractEntitiesWithLLM(userMessage);
      this.eventDetails = { ...this.eventDetails, ...newEntities };

      const stillMissing = this.promptForMissingDetails(this.eventDetails);
      if (stillMissing) {
        this.messages.push({ text: `Still need these details:\n${stillMissing}`, sender: "bot" });
      } else {
        this.awaitingMissingFields = false;
        this.awaitingConfirmation = true;

        const e = this.eventDetails;
        this.messages.push({
          text: `🎮 All set! Should I create a ${e.eventType} event in ${e.location} on ${new Date(e.startDate).toLocaleString()} for ${e.playerCount} players? (yes/no)`,
          sender: "bot"
        });
      }
      return;
    }

    // ✅ Confirm before creation
    if (this.awaitingConfirmation) {
      if (userMessage.toLowerCase().includes("yes")) {
        this.awaitingConfirmation = false;
        this.messages.push({ text: "✅ Your event has been created successfully 🎉", sender: "bot" });
        this.eventDetails = {};
      } else {
        this.awaitingConfirmation = false;
        this.messages.push({ text: "❌ Event creation cancelled. Let me know if you want to try again.", sender: "bot" });
      }
      return;
    }

    // 🤖 Try extracting event entities
    const extracted = await this.extractEntitiesWithLLM(userMessage);

    // 🎤 Handle non-gaming case
    if (extracted?.eventType === "non-gaming") {
      this.awaitingConversionConfirmation = true;
      this.messages.push({ text: "🎤 That looks like a non-gaming event. GameX only supports gaming events. Want to convert this to a gaming event?", sender: "bot" });
      return;
    }

    // ❓ Prompt for missing data
    const missingPrompt = this.promptForMissingDetails(extracted);
    if (missingPrompt) {
      this.eventDetails = { ...this.eventDetails, ...extracted };
      this.awaitingMissingFields = true;
      this.messages.push({ text: `I need a few more details to proceed:\n${missingPrompt}`, sender: "bot" });
      return;
    }

    // ✅ All data is present
    this.eventDetails = extracted;
    this.awaitingConfirmation = true;
    this.messages.push({
      text: `🎮 Got it! Should I create a ${extracted.eventType} event in ${extracted.location} on ${new Date(extracted.startDate).toLocaleString()} for ${extracted.playerCount} players? (yes/no)`,
      sender: "bot"
    });
  }




  handleConfirmation(message: string) {
    const lower = message.toLowerCase();
    if (['yes', 'y', 'confirm', 'okay', 'ok', 'sure'].includes(lower)) {
      this.messages.push({
        sender: 'bot',
        text: `🎉 Awesome! Your gaming event has been successfully scheduled on Game-X. We'll keep you updated with the next steps.`
      });
      this.awaitingResponse = null;
      this.confirmationShown = false;
      this.eventDetails = {}; // Optionally reset for next event
    } else {
      this.messages.push({
        sender: 'bot',
        text: `❓ No worries! If you'd like to make changes, just let me know what you'd like to update.`
      });
      this.awaitingResponse = null;
      this.confirmationShown = false;
    }

    this.scrollToBottom();
  }


  async handlePredefinedMessages(message: string) {
    const normalizedMessage = message.toLowerCase().replace(/\s+/g, ' ').trim();
    const intent = classifyIntent(normalizedMessage);
    let response = '';

    switch (intent) {
      case 'greeting':
        response = 'Hi there! How can I assist you today?';
        break;
      case 'farewell':
        response = 'Goodbye! Have a great day!';
        break;
      case 'help':
        response = 'Sure! I can assist you with gaming, tournaments. What do you need help with?';
        break;
      case 'network_command':
        this.getNetworkPaths();
        this.processing = false;
        return;
      case 'structured_event':
        await this.extractEventDetails(message);
        this.processing = false;
        return;
      case 'general_query':
        await this.queryLLM(message);
        this.processing = false;
        return;
      default:
        if (this.awaitingResponse) {
          await this.extractEventDetails(message);
        } else {
          await this.queryLLM(message);
        }
        this.processing = false;
        return;
    }

    this.messages.push({ text: response, sender: "bot" });
    this.processing = false;
    this.scrollToBottom();
  }

  // extractEntitiesWithLLM(userMessage: string): Promise<any> {
  //   const payload = {
  //     model: "mistral-7b-instruct-v0.1.Q3_K_M.gguf",
  //     messages: [
  //       {
  //         role: "system",
  //         content: `You are an event assistant on Game-X. Extract details from the user message *only* if it's about a gaming event.
  // Return a JSON with the following keys:
  // - eventType: string
  // - location: string
  // - startDate: ISO 8601 datetime (e.g., 2025-06-15T12:00:00)
  // - endDate: ISO 8601 datetime
  // - playerCount: number

  // If it's not a gaming event (e.g., music, comedy, etc.), return: { "eventType": "non-gaming" }`
  //       },
  //       {
  //         role: "user",
  //         content: userMessage
  //       }
  //     ],
  //     max_tokens: 300,
  //     temperature: 0.2
  //   };

  //   return fetch("http://localhost:11434/api/chat", {
  //     method: "POST",
  //     body: JSON.stringify(payload),
  //     headers: {
  //       "Content-Type": "application/json"
  //     }
  //   })
  //   .then(res => res.json())
  //   .then(data => {
  //     try {
  //       return JSON.parse(data.choices[0].message.content);
  //     } catch (err) {
  //       console.error("❌ Failed to parse LLM JSON:", err, data.choices[0].message.content);
  //       return {};
  //     }
  //   });
  // }


  async extractEventDetails(message: string) {
    const details = await extractEntitiesWithLLM(message);

    if (!details) {
      this.messages.push({
        text: "🤖 Sorry, I couldn't understand that. Could you rephrase?",
        sender: "bot"
      });
      this.scrollToBottom();
      return;
    }

    // Validate and normalize event type
    if (!this.validateEventType(details.eventType)) {
      return this.rejectEventType(details.eventType);
    }


    // Validate location if provided
    if (details.location) {
      if (!this.validateLocation(details.location)) {
        return this.rejectLocation(details.location);
      }
    }

    // Validate player count if provided
    if (details.playerCount !== undefined && details.playerCount !== null) {
      if (!this.validatePlayerCount(details.playerCount)) {
        return this.rejectPlayerCount(details.playerCount);
      }
    }

    // Merge valid details into eventDetails
    this.eventDetails = { ...this.eventDetails, ...details };

    // Prompt for missing fields
    this.promptForMissingDetails(this.eventDetails);
  }


  validateEventType(type: string) {
    if (type?.toLowerCase().includes('gaming')) {
      this.eventDetails.eventType = 'gaming';
      return true;
    }
    return false;
  }

  rejectEventType(type: string) {
    this.messages.push({
      text: `⚠️ Sorry, we cannot host <strong>${type}</strong> events. We currently support only <strong>gaming</strong> events.`,
      sender: "bot"
    });
    this.scrollToBottom();
  }

  validateLocation(location: string) {
    const validLocations = ['riyadh'];
    return validLocations.includes(location?.toLowerCase());
  }

  rejectLocation(location: string) {
    this.awaitingResponse = null;
    this.messages.push({
      text: "📍 Sorry! Currently, we are not available in this location.",
      sender: "bot"
    });
    this.scrollToBottom();
  }

  validatePlayerCount(count: number) {
    return count && count <= 1000;
  }

  rejectPlayerCount(count: number) {
    this.messages.push({
      text: `🎮 Whoa! That’s a full-blown battle royale! We can only host up to <strong>1000 players</strong>. Ready to trim the squad?`,
      sender: "bot"
    });
    this.scrollToBottom();
  }
  promptForMissingDetails(eventDetails: any): string {
    const questions = [];

    if (!eventDetails.location) questions.push("📍 Where will the event take place?");
    if (!eventDetails.startDate) questions.push("📅 When is the event scheduled to start?");
    if (!eventDetails.endDate) questions.push("🕒 When will the event end?");
    if (!eventDetails.playerCount) questions.push("👥 How many players are expected?");
    if (!eventDetails.eventType || eventDetails.eventType === "non-gaming") questions.push("🎮 What type of gaming event is it (e.g., FPS, Battle Royale)?");

    return questions.join("\n");
  }

  // promptForMissingDetails() {
  //   const { eventType, location, startDate, endDate, playerCount } = this.eventDetails;

  //   if (!eventType) {
  //     this.awaitingResponse = 'eventType';
  //     this.messages.push({
  //       text: `🎮 What type of gaming event are you planning to host?`,
  //       sender: "bot"
  //     });
  //   } else if (!location) {
  //     this.awaitingResponse = 'location';
  //     this.messages.push({
  //       text: `🗺️ Got it! You're planning a ${eventType} event.<br>
  // Could you please confirm the <strong>primary location</strong> for your event?`,
  //       sender: "bot"
  //     });
  //   } else if (!startDate && !endDate) {
  //     this.awaitingResponse = 'startAndEndDate';
  //     this.messages.push({
  //       text: `📅 Excellent! ${location} it is.<br>
  // Now, could you provide the <strong>start and end dates</strong> for your event?<br>
  // (e.g., 04/07/2025 - 06/07/2025)`,
  //       sender: "bot"
  //     });
  //   } else if (!startDate) {
  //     this.awaitingResponse = 'startDate';
  //     this.messages.push({
  //       text: `📆 Thanks! Could you please provide the <strong>start date</strong> for the event?`,
  //       sender: "bot"
  //     });
  //   } else if (!endDate) {
  //     this.awaitingResponse = 'endDate';
  //     this.messages.push({
  //       text: `📆 Got it. Could you now provide the <strong>end date</strong> for the event?`,
  //       sender: "bot"
  //     });
  //   } else if (playerCount === undefined || playerCount === null)      {
  //     this.awaitingResponse = 'playerCount';
  //     this.messages.push({
  //       text: `👥 Could you tell me the <strong>estimated number of players</strong> you anticipate at peak?`,
  //       sender: "bot"
  //     });
  //   } else {
  //     this.awaitingResponse = 'confirmation';
  //     this.confirmationShown = true;
  //     this.messages.push({
  //       sender: 'GameX Assistant',
  //       text: `
  // ✅ Alright, let's confirm your request:<br><br>
  // • <strong>Event Type:</strong> ${eventType}<br>
  // • <strong>Location:</strong> ${location}<br>
  // • <strong>Dates:</strong> ${startDate} - ${endDate}<br>
  // • <strong>Estimated Players:</strong> ${playerCount}<br><br>
  // Does this sound correct to you?`
  //     });
  //   }

  //   this.scrollToBottom();
  // }


  async queryLLM(userMessage: string): Promise<string> {
    this.processing = true;

    const payload = {
      model: "mistral-7b-instruct-v0.1.Q3_K_M.gguf",
      messages: [
        { role: "user", content: userMessage }
      ],
      max_tokens: 150,
      temperature: 0.7
    };

    try {
      const res = await fetch("http://35.171.185.203:8000/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      return data.choices?.[0]?.message?.content || "I'm not sure how to help with that.";
    } catch (err) {
      console.error(err);
      return "❌ Oops! Something went wrong while processing your request.";
    } finally {
      this.processing = false;
      this.scrollToBottom();
    }
  }




  getNetworkPaths() {
    this.processing = true;
    this.scrollToBottom();

    this.http.get<any>('https://cognizantdemo4.service-now.com/api/x_gtsip_agenticai/network/nqmetric').subscribe({
      next: (response) => {
        const result = response.result;

        const responseText = result?.response_text || "No response text available.";
        const orderId = result?.order_id || "N/A";
        const responseTime = result?.response_date_time || "Unknown";

        const [bestPart, altPart] = responseText.split("Alternative Paths:");
        const bestFormatted = bestPart?.replace("Best Path:", "• <strong>Best Path:</strong>").trim();
        const altFormatted = altPart
          ? altPart.split(" | ").map((path: string) => `• ${path.trim()}`).join("<br>")
          : "• No alternative paths found.";

        const message = `
          ⏱️ <strong>Last Update:</strong> ${new Date(responseTime).toLocaleString()}<br><br>
          📡 <strong>Network Path Info:</strong><br>
          ${bestFormatted}<br><br>
          🔁 <strong>Alternative Paths:</strong><br>
          ${altFormatted}
        `;

        setTimeout(() => {
          this.messages.push({ text: message, sender: "GameX Assistant" });
          this.scrollToBottom();
          this.processing = false;

          // Final wrap-up message
          setTimeout(() => {
            this.processing = true;
            this.scrollToBottom();

            setTimeout(() => {
              this.messages.push({
                text: "That’s the latest on your network routing. If you’d like to explore optimization options or simulate traffic scenarios, just let me know!",
                sender: "GameX Assistant"
              });
              this.scrollToBottom();
              this.processing = false;
            }, 1200);
          }, 1000);
        }, 1200);
      },
      error: () => {
        this.messages.push({
          text: "⚠️ Unable to fetch network paths from ServiceNow. Please try again later.",
          sender: "GameX Assistant"
        });
        this.scrollToBottom();
        this.processing = false;
      },
    });
  }




  handleMissingInfo(userInput: string) {
    if (!this.awaitingResponse) return;

    const dateRegex = /(\d{2}\/\d{2}\/\d{4})/g;
    const dates = userInput.match(dateRegex);
    const normalizedInput = userInput.toLowerCase();

    switch (this.awaitingResponse) {
      case 'eventType':
        if (this.validateEventType(userInput)) {
          this.eventDetails.eventType = 'gaming';
        } else {
          this.rejectEventType(userInput);
          return;
        }
        break;

      case 'confirmation':
        if (normalizedInput === 'yes') {
          this.awaitingResponse = null;
          this.processing = true;
          this.scrollToBottom();

          setTimeout(() => {
            this.messages.push({
              text: `🎉 Fantastic!<br>
  Just a moment while our system performs a quick feasibility check and reserves the necessary network resources.<br><br>
  This ensures we can deliver the <strong>ultra-low latency</strong> and <strong>high bandwidth</strong> your event demands.`,
              sender: "GameX Assistant"
            });
            this.scrollToBottom();
            this.processing = false;

            setTimeout(() => {
              this.processing = true;
              this.scrollToBottom();

              setTimeout(() => {
                this.messages.push({
                  text: `✅ Great news!<br>
  Network capacity is available and your request can be fulfilled.<br><br>
  We can provision these services live for your event.<br><br>
  Would you like to <strong>confirm and pre-activate</strong> the request?`,
                  sender: "GameX Assistant"
                });
                this.awaitingResponse = 'finalConfirmation';
                this.processing = false;
                this.scrollToBottom();
              }, 1200);
            }, 2000);
          }, 3000);
        } else {
          this.messages.push({
            text: "⚠️ Please provide the correct details.",
            sender: "bot"
          });
          this.awaitingResponse = null;
          this.scrollToBottom();
        }
        break;

      case 'finalConfirmation':
        if (normalizedInput === 'yes') {
          this.awaitingResponse = null;
          this.createQuote();
        } else {
          this.processing = true;
          this.scrollToBottom();

          setTimeout(() => {
            this.messages.push({
              text: `👍 No problem!<br>
  Let me know if you'd like to make any changes or need more time.`,
              sender: "GameX Assistant"
            });
            this.awaitingResponse = null;
            this.processing = false;
            this.scrollToBottom();
          }, 1000);
        }
        break;

      case 'location':
        this.eventDetails.location = userInput;
        break;

      case 'startAndEndDate':
        if (dates && dates.length >= 2) {
          this.eventDetails.startDate = this.formatDateToDDMMYYYY(dates[0]);
          this.eventDetails.endDate = this.formatDateToDDMMYYYY(dates[1]);
          this.awaitingResponse = null;
        } else if (dates && dates.length === 1) {
          this.eventDetails.startDate = this.formatDateToDDMMYYYY(dates[0]);
          this.awaitingResponse = 'endDate';

          this.processing = true;
          this.scrollToBottom();

          setTimeout(() => {
            this.messages.push({
              text: "📅 Thanks! Now, could you please provide the <strong>end date</strong> for the event?",
              sender: "bot"
            });
            this.processing = false;
            this.scrollToBottom();
          }, 1000);
          return;
        } else {
          this.processing = true;
          this.scrollToBottom();

          setTimeout(() => {
            this.messages.push({
              text: `⚠️ I couldn't understand the dates.<br>
  Please provide them in the format: <strong>DD/MM/YYYY</strong>.`,
              sender: "bot"
            });
            this.processing = false;
            this.scrollToBottom();
          }, 1000);
          return;
        }
        break;

      case 'startDate':
        this.eventDetails.startDate = this.formatDateToDDMMYYYY(userInput);
        break;

      case 'endDate':
        this.eventDetails.endDate = this.formatDateToDDMMYYYY(userInput);
        break;

      case 'playerCount':
        const count = parseInt(userInput, 10);
        if (count > 1000) {
          this.processing = true;
          this.scrollToBottom();

          setTimeout(() => {
            this.messages.push({
              text: `🚫 Sorry, the number of players cannot exceed <strong>1000</strong>.<br>
  Please provide a lower number of participants.`,
              sender: "bot"
            });
            this.processing = false;
            this.scrollToBottom();
          }, 1000);
          return;
        }
        this.eventDetails.playerCount = userInput;
        break;
    }

    this.awaitingResponse = null;

    if (!this.confirmationShown && Object.keys(this.eventDetails).length > 0) {
      this.promptForMissingDetails(this.eventDetails);
    }
  }





  formatDateToDDMMYYYY(dateStr: string): string | null {
    const months: { [key: string]: string } = {
      january: '01', february: '02', march: '03', april: '04',
      may: '05', june: '06', july: '07', august: '08',
      september: '09', october: '10', november: '11', december: '12'
    };

    const parts = dateStr.toLowerCase().replace(/(st|nd|rd|th)/g, '').split(/[\s/-]+/);
    if (parts.length === 3) {
      let [day, month, year] = parts;

      if (isNaN(Number(month))) {
        month = months[month.toLowerCase()];
      }

      if (day.length === 1) day = '0' + day;
      if (month && year && day) {
        return `${day}/${month}/${year}`;
      }
    }

    return null;
  }

  createQuote() {
    const orderId = this.generateRandomId('ORD');
    const requestBody = {
      orderId: orderId,
      queryId: this.generateRandomId('ORDL'),
      location: this.eventDetails.location,
      playerCount: this.eventDetails.playerCount,
      startDate: this.eventDetails.startDate,
      endDate: this.eventDetails.endDate,
      status: "New"
    };

    const headers = new HttpHeaders({
      'Authorization': 'Basic ' + btoa('tmfcatalyst:Cts@2025'),
      'Content-Type': 'application/json'
    });

    this.processing = true;
    this.scrollToBottom();

    setTimeout(() => {
      this.messages.push({
        text: "Creating your order and reserving network resources...",
        sender: "GameX Assistant"
      });
      this.scrollToBottom();
      this.processing = false;

      this.processing = true;
      this.scrollToBottom();

      this.http.post('/api/api/x_gtsip_agenticai/intentquery/query', requestBody, { headers })
        .subscribe({
          next: () => {
            setTimeout(() => {
              this.messages.push({
                text: `Thank you! Your Order ID is: ${orderId}. Your network request is currently undergoing service qualification.`,
                sender: "GameX Assistant"
              });
              this.scrollToBottom();
              this.processing = false;

              setTimeout(() => {
                this.getQuoteDetails(orderId);
              }, 3000);
            }, 2000);
          },
          error: () => {
            this.messages.push({
              text: "Failed to create quote. Please try again later.",
              sender: "bot"
            });
            this.scrollToBottom();
            this.processing = false;
          }
        });
    }, 1000);
  }


  getQuoteDetails(orderId: string) {
    const headers = new HttpHeaders({
      'Authorization': 'Basic ' + btoa('tmfcatalyst:Cts@2025'),
      'Content-Type': 'application/json'
    });

    this.processing = true;
    this.scrollToBottom();

    this.http.get('/api/api/x_gtsip_agenticai/intentquery/querylast', { headers })
      .subscribe({
        next: (response: any) => {
          const result = response.result;
          const startDate = result.startDate
            ? this.formatDateToDDMMYYYY(result.startDate)
            : 'N/A';
          const endDate = result.endDate
            ? this.formatDateToDDMMYYYY(result.endDate)
            : 'N/A';
          const status = result.status || 'N/A';
          const location = result.location || 'N/A';
          const playerCount = parseInt(result.playerCount, 10);

          setTimeout(() => {
            this.messages.push({
              text: `
  🎮 <strong>Gaming Event Network Activated!</strong><br><br>
  <strong>📍 Location:</strong> ${location}<br>
  <strong>🆔 Order ID:</strong> ${orderId}<br>
  <strong>📅 Event Dates:</strong> ${startDate} - ${endDate}<br>
  <strong>✅ Activation Status:</strong> ${status}<br><br>
  Enjoy seamless connectivity and an optimized gaming experience!
              `,
              sender: "GameX Assistant"
            });

            this.scrollToBottom();
            this.processing = false;

            setTimeout(() => {
              this.loadNetworkQualityInfo(playerCount);
            }, 2000);
          }, 1500);
        },
        error: () => {
          this.messages.push({
            text: "❌ Failed to fetch quote details. Please try again later.",
            sender: "bot"
          });

          this.scrollToBottom();
          this.processing = false;
        }
      });
  }



  loadNetworkQualityInfo(playerCount: number) {
    this.processing = true;
    this.scrollToBottom();

    this.http.get('/assets/service_intent.json').subscribe((data: any) => {
      let qualityInfo: { bandwidth: string; latency: string; packetLoss: string } | null = null;
      let imageUrl: string = '';
      let summaryData: any[] = [];

      if (playerCount <= 500) {
        qualityInfo = data["0-500"].networkQuality;
        imageUrl = '/assets/images/less_than_500.png';
        summaryData = this.lessThan500Summary;
      } else {
        qualityInfo = data["500-1000"].networkQuality;
        imageUrl = '/assets/images/more_than_500.png';
        summaryData = this.moreThan500Summary;
      }

      if (qualityInfo) {
        setTimeout(() => {
          this.messages.push({
            text: `
  📡 <strong>Network Quality Overview</strong><br><br>
  <strong>📶 Bandwidth:</strong> ${qualityInfo.bandwidth}<br>
  <strong>⏱️ Latency:</strong> ${qualityInfo.latency}<br>
  <strong>📉 Packet Loss:</strong> ${qualityInfo.packetLoss}
            `,
            sender: "GameX Assistant"
          });

          this.scrollToBottom();
          this.processing = false;

          setTimeout(() => {
            this.processing = true;
            this.scrollToBottom();

            setTimeout(() => {
              this.messages.push({
                text: "💰 <strong>Here’s your cost evaluation:</strong>",
                sender: "GameX Assistant",
                imageUrl: imageUrl
              });

              this.scrollToBottom();
              this.processing = false;

              setTimeout(() => {
                this.processing = true;
                this.scrollToBottom();

                setTimeout(() => {
                  const summaryLines = summaryData
                    .filter(item => item["Product Name"])
                    .map(item => `• ${item["Product Name"]}: €${item["Invoice Cost"]}`)
                    .join("<br>");

                  const total = summaryData.find(item => item.Total)?.Total || "N/A";

                  const summaryMessage = `
  🧾 <strong>Service Summary</strong><br>
  ${summaryLines}<br><br>
  <strong>Total Estimated Cost:</strong> €${total}
                  `;

                  this.messages.push({
                    text: summaryMessage,
                    sender: "GameX Assistant"
                  });

                  this.scrollToBottom();
                  this.processing = false;

                  setTimeout(() => {
                    this.processing = true;
                    this.scrollToBottom();

                    setTimeout(() => {
                      this.messages.push({
                        text: `
  ✅ You're all set! Your order has been accepted.<br>
  You can check your invoice anytime in the Monitoring section.<br>
  Looking forward to a successful gaming event! 🎮
                        `,
                        sender: "GameX Assistant"
                      });

                      this.scrollToBottom();
                      this.processing = false;

                      setTimeout(() => {
                        this.messages.push({
                          text: "💬 If you need any further assistance or want to make changes, just let me know.",
                          sender: "GameX Assistant"
                        });

                        this.scrollToBottom();
                        this.processing = false;
                      }, 1200);
                    }, 1200);
                  }, 1000);
                }, 1200);
              }, 1000);
            }, 1200);
          }, 800);
        }, 1200);
      }
    });
  }






  getRecentIntent() {
    const headers = new HttpHeaders({
      'Authorization': 'Basic ' + btoa('tmfcatalyst:Cts@2025'),
      'Content-Type': 'application/json'
    });

    this.processing = true; // Show typing indicator

    this.http.get('/api/api/x_gtsip_agenticai/intent_ai/intentrecent', { headers })
      .subscribe({
        next: (response: any) => {
          this.apiResponse = response;
          const intentId = response?.result?.number || 'INT-XXXXX';

          const messages = [
            "Validating your intent...Hang tight! We're making sure everything checks out. ✅",
            "Provisioning your intent into the network...We're setting things up behind the scenes. Almost there! ⚙️",
            "Intent successfully provisioned! Everything is in place and ready to go.",
            "Your intent is now live and ready for service! You're all set to dive in.",
            `Intent ID: ${intentId} Success! Your intent is active and ready to use.`,
            "Enjoy your gaming experience! Let the fun begin! 🎮🔥",
            "Need anything else? I'm here to help—just say the word!"
          ];

          this.displayMessagesWithDelay(messages, 5000); // 5 seconds delay between messages
        },
        error: () => {
          this.processing = false;
          this.messages.push({ text: "Failed to fetch recent intent. Please try again later.", sender: "bot" });
          this.scrollToBottom();
        }
      });
  }


  displayMessagesWithDelay(messages: string[], delay: number) {
    this.processing = true;
    this.scrollToBottom();

    messages.forEach((msg, index) => {
      setTimeout(() => {
        if (index === messages.length - 1) {
          this.processing = false;
        }
        this.messages.push({ text: msg, sender: "bot" });
        this.scrollToBottom();
      }, delay * index);
    });
  }

  generateRandomId(prefix: string): string {
    return `${prefix}${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`;
  }

  handleKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }
   

  formatMessage(text: string): string {
    return text;
  }

  scrollToBottom() {
    try {
      setTimeout(() => {
        if (this.chatBody && this.chatBody.nativeElement) {
          this.chatBody.nativeElement.scrollTop = this.chatBody.nativeElement.scrollHeight;
        }
      }, 100);
    } catch (err) {
      console.error('Scroll error:', err);
    }
  }
}


