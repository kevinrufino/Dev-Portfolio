import Typewriter from 'typewriter-effect';
import React from 'react';
import DodgeText from '../DodgeText.js';

// eslint-disable-next-line react/prop-types
export const Intro = ({ setCursor }) => {
  return (
    <section
      className='max-w-4xl my-16 px-5 md:my-32 flex flex-col flex-wrap space-y-16 md:space-y-0 patterns m-4 md:m-auto'
      id='intro'
      onMouseEnter={() => {
        setCursor('');
      }}
    >
      <div className='mb-auto space-y-5'>
        <DodgeText
          as='h1'
          className='font-offbit101Bold text-5xl md:text-7xl mt-16 '
        >
          Hey!{' '}
          <span className='wave' role='img' aria-labelledby='wave'>
            👋🏾
          </span>
        </DodgeText>
        <DodgeText as='h2' className='font-offbit101Bold text-5xl md:text-5xl'>
          {'I’m Kevin,'}{' '}
          <Typewriter
            style={{ padding: 50, textAlign: 'left' }}
            options={{
              strings: [
                'Front-end Developer',
                'Full Stack Developer',
                'Creative Engineer',
              ],
              autoStart: true,
              loop: true,
              deleteSpeed: 50,
            }}
          />
        </DodgeText>
        <DodgeText className='font-offbit101Bold text-lg md:text-4xl leading-relaxed'>
          {
            'I enjoy fusing my love for art and tech to build fun interactive experiences. I currently am working at Nike as a Front-end Creative Developer. Check out my work below 👇🏾'
          }
        </DodgeText>
      </div>
    </section>
  );
};
