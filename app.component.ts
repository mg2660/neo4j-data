
import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';


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

  sendMessage() {
    if (this.newMessage.trim()) {
      const userMessage = this.newMessage.trim();
      this.messages.push({ text: userMessage, sender: "user" });
      this.newMessage = '';
      this.processing = true; // Show typing indicator
      this.scrollToBottom();

      setTimeout(() => {
        if (this.awaitingResponse) {
          this.handleMissingInfo(userMessage.toLowerCase());
        } else {
          this.handlePredefinedMessages(userMessage.toLowerCase());
        }

        this.processing = false; // Hide typing indicator
        this.scrollToBottom();
      }, 1200); // 1.2 seconds delay
    }
  }

  handlePredefinedMessages(message: string) {
    let response = '';
    switch (message) {
      case 'hi':
        response = 'Hi there! How can I assist you today?';
        break;
      case 'bye':
        response = 'Goodbye! Have a great day!';
        break;
      case 'how are you':
        response = 'I am just a bot, but I am here to help you!';
        break;
      case 'what is your name':
        response = 'I am GameXBot, your friendly assistant!';
        break;
      case 'help':
        response = 'Sure! I can assist you with gaming, tournaments. What do you need help with?';
        break;
      case 'get intent':
      case 'intent':
      case 'show intent':
        this.getRecentIntent();
        return;
      case 'show network paths':
      case 'show network routes':
      case 'show routes':
      case 'get routes':
      case 'get paths':
        this.getNetworkPaths();
        return;
      default:
        this.extractEventDetails(message);
        return;
    }
    this.messages.push({ text: response, sender: "bot" });
    this.scrollToBottom();
  }

  extractEventDetails(message: string) {
    const eventTypeRegex = /(?:host|organize).*?(\w+)\s+event/i;
    const eventTypeMatch = message.match(eventTypeRegex);

    if (eventTypeMatch) {
      const eventType = eventTypeMatch[1].toLowerCase();
      if (eventType !== 'gaming') {
        this.messages.push({
          text: `⚠️ Sorry, we cannot host <strong>${eventType}</strong> events here.<br>
  We currently support only <strong>gaming</strong> events.`,
          sender: "bot"
        });
        this.scrollToBottom();
        return;
      }
    }

    const locationRegex = /(?:in|on|at)\s+([a-zA-Z\s]+)/i;
    const dateRegex = /(\d{1,2}(?:st|nd|rd|th)?(?:\s+|\/|-)(?:[a-zA-Z]+|\d{1,2})(?:\s+|\/|-)\d{4})/gi;
    const playerCountRegex = /(?:for|with)\s+(\d+)\s+players?/i;

    const locationMatch = message.match(locationRegex);
    const dateMatches = message.match(dateRegex);
    const playerCountMatch = message.match(playerCountRegex);

    if (locationMatch) {
      const location = locationMatch[1].trim();
      if (location.toLowerCase() !== 'riyadh') {
        this.awaitingResponse = null;
        this.messages.push({
          text: "📍 Sorry! Currently, we are not available in this location.",
          sender: "bot"
        });
        this.scrollToBottom();
        return;
      }
      this.eventDetails.location = location;
    }

    if (dateMatches && dateMatches.length >= 2) {
      this.eventDetails.startDate = this.formatDateToDDMMYYYY(dateMatches[0]);
      this.eventDetails.endDate = this.formatDateToDDMMYYYY(dateMatches[1]);
    } else if (dateMatches && dateMatches.length === 1) {
      if (!this.eventDetails.startDate) {
        this.eventDetails.startDate = this.formatDateToDDMMYYYY(dateMatches[0]);
      } else if (!this.eventDetails.endDate) {
        this.eventDetails.endDate = this.formatDateToDDMMYYYY(dateMatches[0]);
      }
    }

    if (playerCountMatch) {
      const count = parseInt(playerCountMatch[1], 10);
      if (count > 1000) {
        this.messages.push({
          text: `🎮 Whoa! That’s a full-blown battle royale!<br>
  We can only host up to <strong>1000 players</strong>.<br>
  Ready to trim the squad?`,
          sender: "bot"
        });
        this.scrollToBottom();
        return;
      }
      this.eventDetails.playerCount = playerCountMatch[1];
    }

    if (!this.eventDetails.location) {
      this.awaitingResponse = 'location';
      this.messages.push({
        text: `🗺️ Got it! You're looking to host a gaming event.<br>
  Could you please confirm the <strong>primary location</strong> for your event?`,
        sender: "bot"
      });
    } else if (!this.eventDetails.startDate && !this.eventDetails.endDate) {
      this.awaitingResponse = 'startAndEndDate';
      this.messages.push({
        text: `📅 Excellent! Riyadh it is.<br>
  Now, could you provide the <strong>start and end dates</strong> for your event?<br>
  (e.g., DD/MM/YYYY - DD/MM/YYYY)`,
        sender: "bot"
      });
    } else if (!this.eventDetails.startDate) {
      this.awaitingResponse = 'startDate';
      this.messages.push({
        text: `📆 Thanks! Could you please provide the <strong>start date</strong> for the event?`,
        sender: "bot"
      });
    } else if (!this.eventDetails.endDate) {
      this.awaitingResponse = 'endDate';
      this.messages.push({
        text: `📆 Got it. Could you now provide the <strong>end date</strong> for the event?`,
        sender: "bot"
      });
    } else if (!this.eventDetails.playerCount) {
      this.awaitingResponse = 'playerCount';
      this.messages.push({
        text: `👥 Could you tell me the <strong>estimated number of players</strong> you anticipate at peak?`,
        sender: "bot"
      });
    } else {
      const confirmationMessage = `
  ✅ Alright, let's confirm your request:<br><br>
  • <strong>Event Type:</strong> Gaming Event<br>
  • <strong>Location:</strong> ${this.eventDetails.location}<br>
  • <strong>Dates:</strong> ${this.eventDetails.startDate} - ${this.eventDetails.endDate}<br>
  • <strong>Estimated Players:</strong> ${this.eventDetails.playerCount}<br><br>
  Does this sound correct to you?`;

      this.messages.push({
        sender: 'GameX Assistant',
        text: confirmationMessage
      });

      this.confirmationShown = true;
      this.awaitingResponse = 'confirmation';
    }

    this.scrollToBottom();
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

    if (!this.confirmationShown) {
      this.extractEventDetails('');
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
    if (event.key === 'Enter') {
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


