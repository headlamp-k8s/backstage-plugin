import React from 'react';
import { IconComponent } from '@backstage/core-plugin-api';


export const HeadlampIcon: IconComponent = ({ fontSize = 'medium' }) => {
  // Calculate size based on fontSize prop
  const getSize = () => {
    switch (fontSize) {
      case 'small':
        return 20;
      case 'large':
        return 35;
      case 'medium':
      case 'inherit':
        return '1em';
      default:
        return 24;
    }
  };

  const size = getSize();
  const numericSize = typeof size === 'string' ? 24 : size;

  return (
    <svg
      width={size}
      height={numericSize * (512/408)} 
      viewBox="0 0 408 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M407.951 324.939V204.686L376.111 163.18V93.246L274.052 56.573V0H133.899V56.573L31.8399 93.246V163.18L0 204.686V324.939L31.8399 367.867L0 466.798L204.117 512L407.951 466.798L376.111 367.867L407.951 324.939Z"
        fill="black"
      />
      <path
        d="M204.118 367.867C260.406 367.867 306.176 322.097 306.176 265.808C306.176 209.519 260.406 163.749 204.118 163.749C147.829 163.749 102.059 209.519 102.059 265.808C102.059 322.097 147.829 367.867 204.118 367.867Z"
        fill="#FFF200"
      />
    </svg>
  );
};
