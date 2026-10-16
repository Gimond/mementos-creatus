import {forwardRef, useImperativeHandle, useState} from 'react';
import {parseStatBlock, type StatBlockAttributes} from './statblockParser';

export interface StatBlockHandle {
    attributes: StatBlockAttributes;
}

const StatBlock = forwardRef<StatBlockHandle>((_props, ref) => {
    const [statblock, setStatblock] = useState('');
    const [attributes, setAttributes] = useState<StatBlockAttributes>({});

    // Exposer les attributs via la ref
    useImperativeHandle(ref, () => ({
        attributes: attributes
    }));

    const handleStatBlockChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        setStatblock(event.target.value);
        setAttributes(parseStatBlock(event.target.value));
    };

    return (
        <form>
            <textarea value={statblock} onChange={handleStatBlockChange} autoFocus />
        </form>
    );
});

export default StatBlock;
