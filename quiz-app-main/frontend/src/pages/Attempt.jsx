import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import API from '../services/api';
import './Attempt.css';

const Attempt = () => {
  const { id } = useParams();
  const [attempt, setAttempt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await API.get(`/scores/${id}`);
        setAttempt(res.data.data);
      } catch (e) {
        setError(e.response?.data?.message || 'Failed to load attempt');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id]);

  if (loading) {
    return (
      <div className="attempt-loading">
        <div className="spinner"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="attempt-container">
        <div className="error-message">{error}</div>
        <Link to="/history" className="btn-primary">Back to History</Link>
      </div>
    );
  }

  const questions = attempt?.questions || [];

  return (
    <div className="attempt-container">
      <div className="attempt-header">
        <div>
          <h1>Quiz Attempt</h1>
          <p>{attempt?.category} · {attempt?.difficulty}</p>
        </div>
        <Link to="/history" className="btn-secondary">Back</Link>
      </div>

      <div className="attempt-stats">
        <div className="stat-card">
          <span className="stat-label">Score</span>
          <span className="stat-value">{attempt?.score} / {attempt?.maxScore}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Accuracy</span>
          <span className="stat-value">{attempt?.percentage}%</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Correct</span>
          <span className="stat-value">{attempt?.correctAnswers} / {attempt?.totalQuestions}</span>
        </div>
      </div>

      <div className="attempt-list">
        {questions.map((q, idx) => {
          const options = q.options || [];
          const userAnswer = q.userAnswer;
          const correctAnswer = q.correctAnswer;
          const isSkipped = !userAnswer;
          
          return (
            <div key={q.questionId || idx} className={`attempt-item ${isSkipped ? 'skipped' : q.isCorrect ? 'correct' : 'wrong'}`}>
              <div className="attempt-question">{idx + 1}. {q.questionText}</div>
              
              <div className="attempt-options">
                {options.map((opt, optIdx) => {
                  const isUserAnswer = opt === userAnswer;
                  const isCorrectAnswer = opt === correctAnswer;
                  let optionClass = 'attempt-option';
                  if (isCorrectAnswer) optionClass += ' correct';
                  else if (isUserAnswer && !q.isCorrect) optionClass += ' wrong';
                  else if (isUserAnswer && q.isCorrect) optionClass += ' user-correct';
                  
                  return (
                    <div key={optIdx} className={optionClass}>
                      <span className="option-letter">{String.fromCharCode(65 + optIdx)}</span>
                      <span className="option-text">{opt}</span>
                      {isCorrectAnswer && <span className="option-badge correct-badge">Correct</span>}
                      {isUserAnswer && !isCorrectAnswer && <span className="option-badge wrong-badge">Your answer</span>}
                      {isUserAnswer && isCorrectAnswer && <span className="option-badge correct-badge">Correct</span>}
                    </div>
                  );
                })}
              </div>
              
              {q.explanation && <div className="attempt-explanation"><strong>Explanation:</strong> {q.explanation}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Attempt;
