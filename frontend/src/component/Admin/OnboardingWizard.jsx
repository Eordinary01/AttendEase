// src/components/Admin/OnboardingWizard.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from "../../utils/api";
import { logError } from "../../utils/logger";
import {
  CheckCircle,
  Circle,
  Users,
  BookOpen,
  Upload,
  Building2,
  ArrowRight,
  ArrowLeft,
  ChevronRight,
  Award,
  Link2,
  Copy
} from 'lucide-react';
import Card from "../common/ui/Card";
import Button from "../common/ui/Button";

const OnboardingWizard = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [setupStatus, setSetupStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const loginLink = `${window.location.origin}/login/${localStorage.getItem('tenantSubdomain') || ''}`;

  const handleCopyLoginLink = () => {
    navigator.clipboard?.writeText(loginLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const steps = [
    {
      id: 'profile',
      title: 'Complete Profile',
      description: 'Set up your institution profile',
      icon: <Building2 className="w-6 h-6" />,
      action: () => navigate('/profile')
    },
    {
      id: 'teachers',
      title: 'Add Teachers',
      description: 'Create teacher accounts',
      icon: <Users className="w-6 h-6" />,
      action: () => navigate('/admin/manage-teachers')
    },
    {
      id: 'subjects',
      title: 'Add Subjects',
      description: 'Create subjects for your institution',
      icon: <BookOpen className="w-6 h-6" />,
      action: () => navigate('/admin/manage-subjects')
    },
    {
      id: 'students',
      title: 'Upload Students',
      description: 'Upload student enrollments',
      icon: <Upload className="w-6 h-6" />,
      action: () => navigate('/admin/upload-enrollments')
    }
  ];

  useEffect(() => {
    fetchSetupStatus();
  }, []);

  const fetchSetupStatus = async () => {
    try {
      const response = await api.get('/tenant/setup-status');
      setSetupStatus(response.data.data);
    } catch (error) {
      logError("Fetch Setup Status", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStepClick = (step) => {
    step.action();
  };

  const handleSkip = () => {
    localStorage.setItem('onboardingCompleted', 'true');
    navigate('/dashboard');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-16 h-16 border-4 border-primary-soft border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  if (setupStatus?.allCompleted) {
    return (
      <div className="flex items-center justify-center p-4 min-h-[60vh]">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full max-w-md"
        >
          <Card padding="lg" className="text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Award className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-ink mb-2">Setup Complete! 🎉</h2>
            <p className="text-ink-soft mb-6">
              Your institution is ready to go. You can now start using all features.
            </p>
            <Button
              onClick={() => navigate('/dashboard')}
              className="bg-gradient-to-r from-primary to-secondary hover:from-primary-dark hover:to-secondary-dark"
            >
              Go to Dashboard
            </Button>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-ink mb-2">
          Welcome to AttendEase ERP! 🚀
        </h1>
        <p className="text-ink-soft">
          Let's get your institution set up in a few simple steps
        </p>
      </div>

      {/* Unique Login Link */}
      <Card padding="lg">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-primary-soft flex items-center justify-center flex-shrink-0">
              <Link2 className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-ink">Your Institution's Unique Login Link</p>
              <p className="text-sm text-ink-soft mt-0.5">
                Share this link with teachers, students & parents. Only members of your institution can log in through it.
              </p>
              <div className="flex items-center gap-2 mt-3">
                <input
                  type="text"
                  readOnly
                  value={loginLink}
                  onFocus={(e) => e.target.select()}
                  className="flex-1 min-w-0 px-3 py-2 bg-background border border-line rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
                <Button variant="outline" onClick={handleCopyLoginLink} leftIcon={Copy}>
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Progress */}
      <Card padding="xl">
        <div className="flex items-center justify-between mb-8">
          <div className="flex-1">
            <div className="h-2 bg-line rounded-full">
              <div
                className="h-2 bg-primary rounded-full transition-all duration-500"
                style={{ width: `${setupStatus?.percentage || 0}%` }}
              />
            </div>
          </div>
          <span className="ml-4 text-sm font-medium text-primary">
            {setupStatus?.percentage || 0}% Complete
          </span>
        </div>

        <div className="grid gap-4">
          {steps.map((step, index) => {
            const isCompleted = setupStatus?.steps[step.id]?.completed;
            const isCurrent = currentStep === index;
            
            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`border rounded-xl p-4 transition-all cursor-pointer ${
                  isCompleted
                    ? 'border-green-300 bg-green-50'
                    : isCurrent
                    ? 'border-primary bg-primary-soft'
                    : 'border-line hover:border-primary/40'
                }`}
                onClick={() => !isCompleted && handleStepClick(step)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      isCompleted
                        ? 'bg-green-100 text-green-600'
                        : 'bg-background text-ink-soft'
                    }`}>
                      {isCompleted ? <CheckCircle className="w-6 h-6" /> : step.icon}
                    </div>
                    <div>
                      <h3 className="font-semibold text-ink">{step.title}</h3>
                      <p className="text-sm text-ink-soft">{step.description}</p>
                      {isCompleted && (
                        <span className="text-xs text-green-600 mt-1 block">
                          ✓ Completed
                        </span>
                      )}
                    </div>
                  </div>
                  {!isCompleted && (
                    <ChevronRight className="w-5 h-5 text-ink-faint" />
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-between items-center">
        <Button
          variant="ghost"
          onClick={handleSkip}
        >
          Skip for now
        </Button>
        {currentStep < steps.length && (
          <Button
            rightIcon={ArrowRight}
            onClick={() => {
              if (!setupStatus?.steps[steps[currentStep].id]?.completed) {
                steps[currentStep].action();
              } else {
                setCurrentStep(currentStep + 1);
              }
            }}
            className="bg-gradient-to-r from-primary to-secondary hover:from-primary-dark hover:to-secondary-dark"
          >
            Continue Setup
          </Button>
        )}
      </div>
    </div>
  );
};

export default OnboardingWizard;
