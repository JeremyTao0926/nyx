import { useEffect, useState } from "react";
import { C } from "../utils";

const QUESTIONS = [
  {
    question: "只能選一個？",
    options: ["❤️ 真愛", "💰 一百萬美元"]
  },
  {
    question: "第一次約會更重要？",
    options: ["有趣", "真誠"]
  },
  {
    question: "理想週末？",
    options: ["旅行", "宅家"]
  },
  {
    question: "戀愛中更看重？",
    options: ["陪伴", "成長"]
  },
  {
    question: "你比較像？",
    options: ["感性", "理性"]
  }
];

export function GameScreen() {
  const [timeLeft, setTimeLeft] = useState(15);
  const [round, setRound] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (timeLeft <= 0) {
      nextRound();
      return;
    }
    const timer = setTimeout(() => setTimeLeft(v => v - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft]);

  function nextRound() {
    if (round >= QUESTIONS.length - 1) {
      alert("Heart Rush 完成！+10 互動分");
      return;
    }
    setRound(r => r + 1);
    setSelected(null);
    setTimeLeft(15);
  }

  const q = QUESTIONS[round];

  return (
    <div style={{
      height: "100%",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      background: C.bg,
      padding: 24
    }}>
      <div style={{
        fontSize: 72,
        fontWeight: 900,
        color: timeLeft <= 5 ? "#ff5c5c" : C.gold
      }}>
        {timeLeft}
      </div>

      <div style={{
        fontSize: 28,
        marginTop: 20,
        marginBottom: 30,
        textAlign: "center"
      }}>
        {q.question}
      </div>

      {q.options.map(op => (
        <button
          key={op}
          onClick={() => {
            setSelected(op);
            setTimeout(nextRound, 600);
          }}
          style={{
            width: "100%",
            maxWidth: 400,
            marginBottom: 12,
            padding: 18,
            borderRadius: 18,
            border: `1px solid ${C.gold}`,
            background: selected === op ? C.gold : C.bgCard,
            color: selected === op ? C.bg : C.text
          }}
        >
          {op}
        </button>
      ))}
    </div>
  );
}