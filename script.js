class LogoInterpreter {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");

    this.errorMessageDiv = document.createElement("div");
    this.errorMessageDiv.className = "error-message";
    document
      .querySelector(".canvas-panel .panel-content")
      .appendChild(this.errorMessageDiv);

    this.resetTurtle();

    // Set up the canvas
    this.resizeCanvas();
    window.addEventListener("resize", () => this.resizeCanvas());
  }

  resizeCanvas() {
    const container = this.canvas.parentElement;
    this.canvas.width = container.clientWidth;
    this.canvas.height = container.clientHeight;
    this.clearCanvas();

    // If we have previous drawing commands, redraw them
    this.redrawAll();
  }

  resetTurtle() {
    // Set turtle to center of canvas
    this.turtle = {
      x: this.canvas.width / 2,
      y: this.canvas.height / 2,
      angle: 270, // Up direction
      penDown: true,
      color: "#1c79c4",
      size: 10,
      visible: true,
    };
    this.drawnLines = [];
    this.clearCanvas();
    this.drawTurtle();
    this.updatePositionDisplay();
  }

  clearCanvas() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawTurtle() {
    const ctx = this.ctx;
    const turtle = this.turtle;

    ctx.save();
    ctx.translate(turtle.x, turtle.y);
    ctx.rotate(this.degreesToRadians(turtle.angle)); // Angle is already correct for 'forward'

    // Stylized chevron/arrow shape
    const s = turtle.size;
    ctx.beginPath();
    ctx.moveTo(s * 1.5, 0); // Tip of the arrow
    ctx.lineTo(-s * 0.75, s); // Bottom right wing
    ctx.lineTo(-s * 0.25, 0); // Center notch
    ctx.lineTo(-s * 0.75, -s); // Top right wing
    ctx.closePath();

    ctx.fillStyle = turtle.color;
    ctx.fill();
    ctx.restore();
  }

  degreesToRadians(degrees) {
    return (degrees * Math.PI) / 180;
  }

  showError(message) {
    this.errorMessageDiv.textContent = message;
    this.errorMessageDiv.style.display = "block";
  }

  clearError() {
    this.errorMessageDiv.textContent = "";
    this.errorMessageDiv.style.display = "none";
  }

  preprocessCode(code) {
    const commandStarters = [
      "FORWARD",
      "FD",
      "BACKWARD",
      "BK",
      "LEFT",
      "LT",
      "RIGHT",
      "RT",
      "PENUP",
      "PU",
      "PENDOWN",
      "PD",
      "HIDETURTLE",
      "HT",
      "SHOWTURTLE",
      "ST",
    ];

    // Ensure REPEAT starts on its own line
    code = code.replace(/\s*REPEAT\s+/gi, "\nREPEAT ");

    // Move all [ and ] to their own lines
    code = code.replace(/\[/g, "\n[\n");
    code = code.replace(/\]/g, "\n]\n");

    // Normalize whitespace (optional)
    code = code.replace(/[ \t]+/g, " ");

    // Split into lines for individual command handling
    const lines = code.split("\n");
    const result = [];

    for (let line of lines) {
      line = line.trim();

      if (line === "[" || line === "]" || line.startsWith("REPEAT")) {
        result.push(line);
        continue;
      }

      // Split the line into tokens and insert each command on a new line
      let tokens = line.split(" ");
      let currentLine = "";

      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i].toUpperCase();
        if (commandStarters.includes(token)) {
          if (currentLine.trim()) {
            result.push(currentLine.trim());
          }
          currentLine = token;
        } else {
          currentLine += " " + tokens[i];
        }
      }

      if (currentLine.trim()) {
        result.push(currentLine.trim());
      }
    }

    return result
      .join("\n")
      .replace(/\n{2,}/g, "\n")
      .trim();
  }

  parseLogo(code) {
    const preprocessed = this.preprocessCode(code);
    const lines = preprocessed.toUpperCase().split("\n");
    const commands = [];

    let i = 0;
    while (i < lines.length) {
      const line = lines[i].trim();
      i++;

      // Skip empty lines and comments
      if (line === "" || line.startsWith(";")) {
        continue;
      }

      // Split the line into tokens
      const tokens = line.split(/\s+/);
      const command = tokens[0];

      if (command === "REPEAT") {
        // Check if there's a repeat count
        if (tokens.length < 2 || isNaN(parseInt(tokens[1]))) {
          this.showError(`${command} requires a numeric count.`);
          continue;
        }

        const count = parseInt(tokens[1]);

        // Find the opening bracket
        let openBracketIndex = line.indexOf("[");
        if (openBracketIndex === -1) {
          // If no bracket on this line, look at next line
          if (i < lines.length && lines[i].trim().startsWith("[")) {
            openBracketIndex = 0;
          } else {
            this.showError(`${command} requires an opening bracket [.`);
            continue;
          }
        }

        // Collect commands inside brackets
        let bracketContent = "";
        let bracketLevel = 0;
        let foundClosingBracket = false;

        // If bracket is on same line, start parsing from there
        if (openBracketIndex > 0) {
          const afterBracket = line.substring(openBracketIndex + 1);
          bracketContent += afterBracket + "\n";
          bracketLevel = 1;
        }

        // Continue collecting commands until we find the closing bracket
        while (i < lines.length && !foundClosingBracket) {
          const currentLine = lines[i];
          i++;

          for (let j = 0; j < currentLine.length; j++) {
            if (currentLine[j] === "[") {
              bracketLevel++;
              bracketContent += "[";
            } else if (currentLine[j] === "]") {
              bracketLevel--;
              if (bracketLevel === 0) {
                foundClosingBracket = true;
                break;
              }
              bracketContent += "]";
            } else {
              bracketContent += currentLine[j];
            }
          }

          if (!foundClosingBracket && i < lines.length) {
            bracketContent += "\n";
          }
        }

        if (!foundClosingBracket) {
          this.showError(`${command} is missing a closing bracket ].`);
          continue;
        }

        // Parse the commands inside the brackets recursively
        const repeatCommands = this.parseLogo(bracketContent);

        // Add the repeat command
        commands.push({
          command: "REPEAT",
          count: count,
          commands: repeatCommands,
        });
      } else {
        // Process regular commands
        commands.push({
          command: command,
          args: tokens.slice(1),
        });
      }
    }

    return commands;
  }

  executeCommands(commands) {
    // Clear previous drawing
    this.resetTurtle();

    for (const cmd of commands) {
      this.executeCommand(cmd);
    }
  }

  executeCommand(cmd) {
    if (cmd.command === "REPEAT") {
      // Execute the nested commands 'count' times
      for (let i = 0; i < cmd.count; i++) {
        for (const nestedCmd of cmd.commands) {
          this.executeCommand(nestedCmd);
        }
      }
      return;
    }

    // Handle regular commands as before
    const commandStr =
      cmd.command + (cmd.args.length > 0 ? " " + cmd.args.join(" ") : "");
    this.executeSingleCommand(commandStr);
  }

  executeSingleCommand(commandStr) {
    this.errorMessageDiv.textContent = "";
    commandStr = commandStr.trim().toUpperCase();
    const parts = commandStr.split(/\s+/);
    const command = parts[0];
    const value = parts.length > 1 ? parseFloat(parts[1]) : null;

    const prevX = this.turtle.x;
    const prevY = this.turtle.y;
    let lineDrawn = false;

    switch (command) {
      case "FORWARD":
      case "FD":
        if (value !== null && !isNaN(value)) {
          this.turtle.x +=
            value * Math.cos(this.degreesToRadians(this.turtle.angle));
          this.turtle.y +=
            value * Math.sin(this.degreesToRadians(this.turtle.angle));
          if (this.turtle.penDown) {
            this.drawnLines.push({
              startX: prevX,
              startY: prevY,
              endX: this.turtle.x,
              endY: this.turtle.y,
            });
            lineDrawn = true;
          }
          this.updatePositionDisplay();
        } else {
          this.showError("FORWARD requires a numeric value.");
          return;
        }
        break;
      case "BACKWARD":
      case "BK":
        if (value !== null && !isNaN(value)) {
          this.turtle.x -=
            value * Math.cos(this.degreesToRadians(this.turtle.angle));
          this.turtle.y -=
            value * Math.sin(this.degreesToRadians(this.turtle.angle));
          if (this.turtle.penDown) {
            this.drawnLines.push({
              startX: prevX,
              startY: prevY,
              endX: this.turtle.x,
              endY: this.turtle.y,
            });
            lineDrawn = true;
          }
          this.updatePositionDisplay();
        } else {
          this.showError("BACKWARD requires a numeric value.");
          return;
        }
        break;
      case "LEFT":
      case "LT":
        if (value !== null && !isNaN(value)) {
          this.turtle.angle -= value;
          this.updatePositionDisplay();
        } else {
          this.showError("LEFT requires a numeric value (degrees).");
          return;
        }
        break;
      case "RIGHT":
      case "RT":
        if (value !== null && !isNaN(value)) {
          this.turtle.angle += value;
          this.updatePositionDisplay();
        } else {
          this.showError("RIGHT requires a numeric value (degrees).");
          return;
        }
        break;
      case "PENUP": // Put pen up to move without drawing line
      case "PU":
        this.turtle.penDown = false;
        break;
      case "PENDOWN": // Put pen down to draw line
      case "PD":
        this.turtle.penDown = true;
        break;
      case "HIDETURTLE": // Command to hide the turtle
      case "HT":
        this.turtle.visible = false;
        break;
      case "SHOWTURTLE": // Command to show the turtle
      case "ST":
        this.turtle.visible = true;
        break;
      case "[":
      case "]":
      case "REPEAT":
      case "":
        return;
      default:
        this.showError(`Unknown command: ${command}`);
        return;
    }

    this.redrawAll(); // Redraw canvas with new lines and turtle position
  }

  redrawAll() {
    this.clearCanvas();

    // Draw all lines
    this.ctx.strokeStyle = "#000000";
    this.ctx.lineWidth = 2;

    for (const line of this.drawnLines) {
      this.ctx.beginPath();
      this.ctx.moveTo(line.startX, line.startY);
      this.ctx.lineTo(line.endX, line.endY);
      this.ctx.stroke();
    }

    // Draw turtle
    if (this.turtle.visible) {
      this.drawTurtle();
    }

    this.updatePositionDisplay();
  }

  updatePositionDisplay() {
    const positionDisplay = document.getElementById("turtle-position");
    if (positionDisplay) {
      positionDisplay.textContent = `X: ${Math.round(this.turtle.x)},
                    Y: ${Math.round(this.turtle.y)},
                    Angle: ${Math.round(
                      ((this.turtle.angle % 360) + 360) % 360
                    )}°`;
    }
  }
}

// Pattern library data with LOGO commands
const patternData = {
  square: {
    category: "basic",
    commands: `FD 100
          RT 90
          FD 100
          RT 90
          FD 100
          RT 90
          FD 100
          HT`,
  },
  triangle: {
    category: "basic",
    commands: `FD 100
          RT 120
          FD 100
          RT 120
          FD 100
          HT`,
  },
  star: {
    category: "basic",
    commands: `FD 100
          RT 144
          FD 100
          RT 144
          FD 100
          RT 144
          FD 100
          RT 144
          FD 100
          HT`,
  },
  repeatedTriangles: {
    category: "fractals",
    commands: `REPEAT 3 [
          REPEAT 3 [FD 200 RT 120]
          PU FD 100 PD
          REPEAT 3 [FD 100 RT 120]
          PU RT 60 FD 100 LT 60 PD
          REPEAT 3 [FD 100 RT 120]
          PU LT 60 BK 50 RT 60 PD
          REPEAT 2 [FD 50 RT 120]
          FD 50 ]
          HT`,
  },
  petals: {
    category: "geometric",
    commands: `REPEAT 15 [
          REPEAT 4 [FD 100 RT 60 FD 50 RT 120 FD 50 RT 60 FD 100 RT 36]
          FD 100 RT 60 FD 50 RT 120 FD 50 RT 60 FD 100 ]
          HT`,
  },
  cubes: {
    category: "geometric",
    commands: `PU FD 600 LT 90 FD 450 RT 180 PD
          REPEAT 10 [
              REPEAT 6 [FD 50 RT 60]
              PU FD 50 PD
              REPEAT 6 [FD 50 RT 60]
              PU FD 50 RT 60 FD 50 PD
              REPEAT 5 [FD 50 RT 60]
              FD 50 ]
          REPEAT 10 [
              PU BK 1250 LT 90 FD 346 RT 90 PD
              REPEAT 10 [
                REPEAT 6 [FD 50 RT 60]
                PU FD 50 PD
                REPEAT 6 [FD 50 RT 60]
                PU FD 50 RT 60 FD 50 PD
                REPEAT 5 [FD 50 RT 60]
                FD 50 ]
          ]
          HT`,
  },
  polygons: {
    category: "geometric",
    commands: `REPEAT 10 [
          REPEAT 5 [FD 100 RT 72]
          RT 18
          REPEAT 5 [FD 80 RT 72]
          RT 18
          REPEAT 5 [FD 60 RT 72]
          ]   
          HT`,
  },
  square_spirals: {
    category: "geometric",
    commands: `REPEAT 4 [
          FD 80
          REPEAT 2 [RT 90 FD 20]
          RT 90 FD 60 LT 90 FD 40
          REPEAT 2 [LT 90 FD 20]
          LT 90 FD 60 RT 90 FD 20
          RT 90 FD 80
          REPEAT 2 [RT 90 FD 20]
          RT 90 FD 60 LT 90 FD 40
          REPEAT 2 [LT 90 FD 20]
          LT 90 FD 60 RT 90 FD 20 ]
          HT`,
  },
  sunflower: {
    category: "geometric",
    commands: `REPEAT 18 [
          REPEAT 4 [FD 50 RT 90]
          RT 20 ]
          HT`,
  },
  circles: {
    category: "geometric",
    commands: `REPEAT 20 [
          REPEAT 36 [FD 10 RT 10]
          RT 18 ]
          HT`,
  },
  starlight: {
    category: "geometric",
    commands: `REPEAT 18 [
          FD 150
          BK 150
          RT 20
          FD 100
          BK 100
          RT 5 ]
          HT`,
  },
  crystalline: {
    category: "geometric",
    commands: `REPEAT 8 [
          REPEAT 6 [FD 70 RT 60]
          RT 45 ]
          HT`,
  },
  web: {
    category: "geometric",
    commands: `REPEAT 36 [
          REPEAT 8 [FD 50 RT 45]
          RT 10 ]
          HT`,
  },
  flower: {
    category: "geometric",
    commands: `REPEAT 18 [
          REPEAT 2 [FD 100 RT 45 FD 50 RT 135]
          RT 20 ]
          HT`,
  },
  tetromino: {
    category: "tetromino",
    commands: `PU
          FD 285 RT 90 FD 330 LT 90
          PD
          REPEAT 2 [
              REPEAT 8 [
                  REPEAT 2 [
                      REPEAT 2 [FD 50 RT 90]
                      FD 50 LT 90
                      REPEAT 2 [FD 50 RT 90]
                      REPEAT 2 [FD 50 LT 90]
                      REPEAT 2 [FD 50 RT 90]
                      FD 50 LT 90 FD 50 RT 90
                      REPEAT 2 [FD 50 LT 90]
                      FD 50 RT 90 FD 50
                  ]
                  PU LT 90 FD 100 RT 90 PD
              ]
              PU BK 350 RT 90 FD 850 LT 90 PD
          ]
          HT`,
  },
};

// Initialize pattern cards with data and event listeners
function initializePatternMenu() {
  const patternCards = document.querySelectorAll(".pattern-card");
  const editor = document.getElementById("editor");

  // Add click handlers and data attributes to each card
  patternCards.forEach((card) => {
    const patternId = card.dataset.pattern;
    const patternInfo = patternData[patternId];

    if (patternInfo) {
      // Store commands as a data attribute
      card.dataset.commands = patternInfo.commands;

      // Add click event
      card.addEventListener("click", (event) => {
        // Clean up indentation when pasting to editor
        const cleanedCommands = patternInfo.commands
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.length > 0) // Remove empty lines
          .join("\n");

        editor.value = cleanedCommands;

        // Remove active class from all cards
        patternCards.forEach((c) => c.classList.remove("active"));

        // Add active class to clicked card
        card.classList.add("active");

        // Stop the event from propagating to document
        event.stopPropagation();
      });
    }
  });

  // Initialize custom dropdown functionality
  initializeCustomSelect();

  // Add click event to the document to remove active state when clicking outside
  document.addEventListener("click", (event) => {
    // Check if the click was outside all pattern cards
    const isClickOutsideCards = !event.target.closest(".pattern-card");

    // If clicking outside and not on the category filter dropdown
    if (isClickOutsideCards && !event.target.closest(".custom-select")) {
      // Remove active class from all cards
      patternCards.forEach((card) => {
        card.classList.remove("active");
      });
    }
  });
}

// Custom dropdown functionality
function initializeCustomSelect() {
  const selectTrigger = document.querySelector(".select-trigger");
  const selectDropdown = document.querySelector(".select-dropdown");
  const selectValue = document.querySelector(".select-value");
  const selectOptions = document.querySelectorAll(".select-option");
  const patternCards = document.querySelectorAll(".pattern-card");

  // Toggle dropdown
  selectTrigger.addEventListener("click", (event) => {
    const isOpen = selectDropdown.classList.contains("open");

    if (isOpen) {
      selectDropdown.classList.remove("open");
      selectTrigger.classList.remove("open");
    } else {
      selectDropdown.classList.add("open");
      selectTrigger.classList.add("open");
    }

    event.stopPropagation();
  });

  // Handle option selection
  selectOptions.forEach((option) => {
    option.addEventListener("click", (event) => {
      const selectedCategory = option.dataset.value;
      const text = option.textContent.trim();

      // Update visual state
      selectOptions.forEach((opt) => opt.classList.remove("active"));
      option.classList.add("active");
      selectValue.textContent = text;

      // Close dropdown
      selectDropdown.classList.remove("open");
      selectTrigger.classList.remove("open");

      // Filter patterns (your existing logic)
      patternCards.forEach((card) => {
        if (
          selectedCategory === "all" ||
          card.dataset.category === selectedCategory
        ) {
          card.style.display = "block";
        } else {
          card.style.display = "none";
        }
      });

      event.stopPropagation();
    });
  });

  // Close dropdown when clicking outside
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".custom-select")) {
      selectDropdown.classList.remove("open");
      selectTrigger.classList.remove("open");
    }
  });
}

// Initialize everything when the page loads
document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("turtle-canvas");
  const editor = document.getElementById("editor");
  const runBtn = document.getElementById("run-btn");
  const resetBtn = document.getElementById("reset-btn");

  const interpreter = new LogoInterpreter(canvas);
  interpreter.resetTurtle();

  initializePatternMenu();

  // Run button event
  runBtn.addEventListener("click", () => {
    const code = editor.value.trim();
    if (code === "") {
      interpreter.showError("Please enter LOGO commands before running.");
      return;
    }

    const commands = interpreter.parseLogo(code);
    if (commands.length === 0) {
      interpreter.showError(
        "No valid LOGO commands found. Please check your syntax."
      );
      return;
    }

    // Clear any previous error messages before executing
    interpreter.clearError();
    interpreter.executeCommands(commands);
  });

  // Reset button event
  resetBtn.addEventListener("click", () => {
    interpreter.resetTurtle();
    interpreter.clearError();
    editor.value = "";
  });
});
